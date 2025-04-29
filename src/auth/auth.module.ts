import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [], // ProfileModule no longer needed here
  providers: [AuthGuard],   
  exports: [AuthGuard],     
})
export class AuthModule {} 