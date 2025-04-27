import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatMessagePartDto } from './chat-message-part.dto';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'model'] })
  @IsString()
  @IsIn(['user', 'model'])
  role: 'user' | 'model';

  @ApiProperty({ type: [ChatMessagePartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessagePartDto)
  parts: ChatMessagePartDto[];
} 