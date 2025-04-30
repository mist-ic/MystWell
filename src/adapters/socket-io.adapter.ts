import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: any): Server {
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

    // Create options with CORS configuration
    const corsOptions = {
      ...options,
      path: path, // Explicitly include path
      serveClient: serveClient, // Explicitly include serveClient
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'], // Standard methods for Socket.IO handshake
        credentials: true,
      },
    };

    console.log('Creating Socket.IO server with CORS options:', JSON.stringify(corsOptions.cors));
    return super.createIOServer(port, corsOptions);
  }
} 