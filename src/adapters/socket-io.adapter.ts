import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
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

    const serverOptionsWithCors: ServerOptions = {
      ...options,
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'], // Standard methods for Socket.IO handshake
        credentials: true,
      },
    };

    console.log('Creating Socket.IO server with explicit CORS options:', serverOptionsWithCors.cors);
    return super.createIOServer(port, serverOptionsWithCors);
  }
} 