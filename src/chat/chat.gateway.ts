import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Logger, UnauthorizedException, UseGuards, Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT, SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { ConfigService } from '@nestjs/config';
import { Database } from '../supabase/database.types';

// Define a type for the data stored per socket
interface SocketUserData {
    user: User;
    profileId: string;
}

interface AuthenticatedSocket extends Socket {
    userData?: SocketUserData; // Optional because it's added in middleware
}

// Payload from client when sending a message
interface SendMessagePayload {
  sessionId: string; // Client MUST provide the session ID
  message: string;
}

// Payload for creating a new session
interface CreateSessionPayload {
  title?: string;
}

// Payload for getting history for a specific session
interface GetHistoryPayload {
    sessionId: string;
}

// Type alias for convenience
type ChatSessionRow = Database['public']['Tables']['chat_sessions']['Row'];

@WebSocketGateway({
  // cors: {
  //   origin: configService.get('WEBSOCKET_CORS_ORIGIN'), // Example
  // },
  // namespace: configService.get('WEBSOCKET_NAMESPACE') // Example
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // Store user and profileId object obtained during auth against the socket ID
  private socketUserMap = new Map<string, SocketUserData>();

  constructor(
    private readonly chatService: ChatService,
    // Inject standard client (for auth.getUser)
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    // Inject service role client (for profile check bypassing RLS)
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabaseAdmin: SupabaseClient,
    private readonly configService: ConfigService
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
    // --- Authentication Middleware ---
    server.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        this.logger.warn('WS connection attempt without token.');
        return next(new UnauthorizedException('No authentication token provided'));
      }
      try {
        // 1. Authenticate user using standard client
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        if (error || !user) {
          this.logger.warn(`WS Auth failed: ${error?.message || 'User not found'}`);
          return next(new UnauthorizedException('Invalid authentication token'));
        }
        
        // 2. ---> Fetch Profile ID (use ADMIN client, with retry) <---
        let profileId: string | null = null;
        for (let i = 0; i < 3; i++) { 
          // Use supabaseAdmin here!
          const { data: profileData, error: profileError } = await this.supabaseAdmin 
            .from('profiles')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)
            .maybeSingle(); 

          if (profileError) {
            // Log error but use standard client error message for security
            this.logger.error(`WS Auth: Admin Profile Check Error (Attempt ${i+1}) for user ${user.id}: ${profileError.message}`);
            return next(new UnauthorizedException('Could not verify user profile.'));
          }

          if (profileData) {
            profileId = profileData.id;
            this.logger.log(`WS Auth: Profile ${profileId} found for user ${user.id} on attempt ${i+1} (using admin check)`);
            break; // Profile found, exit loop
          }
          
          if (i < 2) { 
             this.logger.warn(`WS Auth: Profile not found for user ${user.id} on attempt ${i+1} (using admin check). Retrying in 1s...`);
             await new Promise(resolve => setTimeout(resolve, 1000)); 
          } else {
             this.logger.warn(`WS Auth: No profile found for authenticated user ${user.id} after ${i+1} attempts (using admin check).`);
          }
        }

        if (!profileId) {
            return next(new UnauthorizedException('User profile not found. Please complete profile setup.'));
        }
        // ---> End Fetch Profile ID <---

        // 3. Attach user and profileId to socket...
        const socketData: SocketUserData = { user, profileId };
        (socket as AuthenticatedSocket).userData = socketData; 
        this.socketUserMap.set(socket.id, socketData); 
        this.logger.log(`WS Client Authenticated: ${user.id} (Profile: ${profileId}, Socket: ${socket.id})`);
        next();
      } catch (e) {
        this.logger.error(`WS Auth exception: ${e.message}`);
        next(new UnauthorizedException('Authentication error'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket, ...args: any[]) {
    const userData = client.userData;
    if (userData?.user?.id) {
        // We already logged authentication in middleware
        this.logger.log(`Client connected: ${client.id} (User: ${userData.user.id}, Profile: ${userData.profileId})`);
        // Optional: Automatically send the user their list of sessions upon connection?
        // this.handleListSessions(client);
    } else {
        // Should not happen if middleware is correct
        this.logger.error(`User object not found on socket ${client.id} after connection event.`);
        client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
     const userData = this.socketUserMap.get(client.id);
     if (userData?.user?.id) {
         this.logger.log(`Client disconnected: ${client.id} (User: ${userData.user.id}, Profile: ${userData.profileId})`);
     } else {
         this.logger.log(`Client disconnected: ${client.id} (User data was not mapped)`);
     }
     // Clean up the mapping
     this.socketUserMap.delete(client.id);
  }

  // --- Event Handlers ---

  @SubscribeMessage('listSessions')
  async handleListSessions(@ConnectedSocket() client: AuthenticatedSocket): Promise<void> {
      const userData = client.userData;
      if (!userData?.profileId) return this.emitAuthError(client, 'listSessions');

      this.logger.log(`Session list requested by user ${userData.user.id} / profile ${userData.profileId} (${client.id})`);
      try {
          // Use the correct profileId fetched during auth
          const profileId = userData.profileId;
          const sessions = await this.chatService.listSessions(profileId);
          this.logger.log(`Sending ${sessions.length} sessions to user ${userData.user.id} / profile ${profileId}`);
          client.emit('sessionList', { sessions }); // Send back the list
      } catch (error) {
          this.logger.error(`Error listing sessions for profile ${userData.profileId}: ${error.message}`, error.stack);
          client.emit('error', { message: 'Failed to retrieve chat sessions.' });
      }
  }

  @SubscribeMessage('createSession')
  async handleCreateSession(
      @MessageBody() payload: CreateSessionPayload,
      @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
      const userData = client.userData;
      if (!userData?.profileId) return this.emitAuthError(client, 'createSession');

      const { title } = payload;
      this.logger.log(`Create session requested by user ${userData.user.id} / profile ${userData.profileId} (${client.id}) with title: ${title}`);
      try {
          // Use the correct profileId
          const profileId = userData.profileId;
          const newSession = await this.chatService.createSession(profileId, title);
          this.logger.log(`New session ${newSession.id} created for profile ${profileId}`);
          client.emit('sessionCreated', { session: newSession }); // Send back the new session info

          // Optionally, immediately send the (empty) history for the new session
          client.emit('chatHistory', { sessionId: newSession.id, history: [] });
      } catch (error) {
          this.logger.error(`Error creating session for profile ${userData.profileId}: ${error.message}`, error.stack);
          client.emit('error', { message: 'Failed to create new chat session.' });
      }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const userData = client.userData;
    if (!userData?.profileId) return this.emitAuthError(client, 'sendMessage');
    
    const { sessionId, message: messageText } = payload;
    if (!sessionId || !messageText) {
        this.logger.warn(`sendMessage handler: Missing sessionId or message from user ${userData.user.id} / profile ${userData.profileId}`);
        client.emit('error', { message: 'Missing session ID or message content.'});
        return;
    }
    
    this.logger.log(`Message received for session ${sessionId} from user ${userData.user.id} / profile ${userData.profileId} (${client.id}): ${messageText}`);

    try {
      // Use the correct profileId
      const profileId = userData.profileId;
      const reply = await this.chatService.sendMessage(sessionId, profileId, messageText);

      this.logger.log(`Sending reply for session ${sessionId} to user ${userData.user.id} / profile ${profileId} (${client.id}): ${reply}`);
      // Emit the reply back to the specific client
      // Include sessionId in the reply event for frontend context
      client.emit('receiveMessage', { 
          sessionId: sessionId, // Echo session ID back
          sender: 'bot', 
          text: reply, 
          timestamp: new Date().toISOString() 
      });

    } catch (error) {
      this.logger.error(`Error processing message for session ${sessionId}, profile ${userData.profileId}: ${error.message}`, error.stack);
      client.emit('error', { message: 'Failed to process your message. Please try again.' });
    }
  }
  
  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @MessageBody() payload: GetHistoryPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
      const userData = client.userData;
      if (!userData?.profileId) return this.emitAuthError(client, 'getHistory');

      const { sessionId } = payload;
      if (!sessionId) {
          this.logger.warn(`getHistory handler: Missing sessionId from user ${userData.user.id} / profile ${userData.profileId}`);
          client.emit('error', { message: 'Missing session ID to get history.'});
          return;
      }
      
      this.logger.log(`History requested by user ${userData.user.id} / profile ${userData.profileId} (${client.id}) for session ${sessionId}`);
      try {
          // Use ChatService to get history
          const profileId = userData.profileId;
          const history = await this.chatService.getSessionHistory(sessionId, profileId);
          
          this.logger.log(`Sending ${history.length} history messages for session ${sessionId} to profile ${profileId}`);
          // Include sessionId in the history event
          client.emit('chatHistory', { sessionId: sessionId, history }); 

      } catch(error) {
          this.logger.error(`Error fetching history for session ${sessionId}, profile ${userData.profileId}: ${error.message}`, error.stack);
          // Let specific errors from service propagate if needed, or handle common ones
          if (error instanceof NotFoundException) {
            client.emit('error', { message: error.message });
          } else if (error instanceof InternalServerErrorException) {
            client.emit('error', { message: error.message });
          } else {
            client.emit('error', { message: 'Failed to retrieve chat history.' });
          }
      }
  }

  // Helper to emit auth error
  private emitAuthError(client: AuthenticatedSocket, handlerName: string) {
    this.logger.error(`${handlerName} handler: User/Profile data not found on socket ${client.id}. Auth middleware might have failed or state is inconsistent.`);
    client.emit('error', { message: 'Authentication error, cannot process request.' });
  }

} 