import { IsNotEmpty, IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class UploadCompleteDto {
  @IsNotEmpty()
  @IsString()
  storagePath: string;

  @IsNotEmpty()
  @IsUUID()
  documentId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;
} 