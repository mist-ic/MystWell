import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: any): Server {
    // Define allowed origins directly without trying to access ConfigService
    const allowedOrigins = [
        'https://mystwell.me',
        'https://www.mystwell.me',
        'https://myst-well.systems',
        'https://www.myst-well.systems',
        'http://localhost:8081',
        'http://localhost:19006',
        'exp://*',
        'capacitor://*'
    ];

    // Create options with CORS configuration
    const corsOptions = {
      ...options,
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      },
    };

    console.log('Creating Socket.IO server with CORS options:', JSON.stringify(corsOptions.cors));
    return super.createIOServer(port, corsOptions);
  }
} 