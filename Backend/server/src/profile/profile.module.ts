import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
 
@Module({
  providers: [ProfileService],
  exports: [ProfileService], // Export ProfileService so AuthModule can use it
})
export class ProfileModule {} 