import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ChatMessagePartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;
} 