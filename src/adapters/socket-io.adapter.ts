import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const configService = this.app.get('ConfigService'); // Get ConfigService if needed for origins
    
    // Define allowed origins directly or fetch from ConfigService
    const allowedOrigins = [
        'https://mystwell.me',
        'https://www.mystwell.me',
        'https://myst-well.systems',
        'https://www.myst-well.systems',
        'http://localhost:8081',
        'http://localhost:19006',
        'exp://*',
        'capacitor://*'
    ]; // Should match main.ts

    // Ensure path is explicitly defined, defaulting to standard socket.io path
    const path = options?.path || '/socket.io';
    // Ensure serveClient is explicitly defined, defaulting to true
    const serveClient = options?.serveClient === undefined ? true : options.serveClient;

    const serverOptionsWithCors: ServerOptions = {
      ...options,
      path: path, // Explicitly include path
      serveClient: serveClient, // Explicitly include serveClient
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'], // Standard methods for Socket.IO handshake
        credentials: true,
      },
    };

    console.log('Creating Socket.IO server with explicit CORS options:', serverOptionsWithCors.cors, 'and path:', serverOptionsWithCors.path, 'serveClient:', serverOptionsWithCors.serveClient);
    // Call super.createIOServer and ensure the return type is Server
    const server: Server = super.createIOServer(port, serverOptionsWithCors);
    return server;
  }
} 