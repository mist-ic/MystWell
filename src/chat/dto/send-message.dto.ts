import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000) // Limit message length
  readonly message: string;

  // Add conversationId later if implementing persistent chat history
  // @IsOptional()
  // @IsUUID()
  // readonly conversationId?: string;
} 