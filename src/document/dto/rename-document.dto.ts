import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameDocumentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255) // Limit title length
  displayName: string;
} 