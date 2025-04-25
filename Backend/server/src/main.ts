import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const frontendUrl = 'http://localhost:8081';
  console.log(`Configuring CORS for origin: ${frontendUrl}`);
  
  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow cookies if needed for auth
  }); 
  
  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';
  
  await app.listen(port, host);
  console.log(`Application is running on: http://localhost:${port} and potentially other interfaces`);
  console.log(`Accepting requests from: ${frontendUrl}`);
}
bootstrap();
