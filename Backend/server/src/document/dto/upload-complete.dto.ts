import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UploadCompleteDto {
  @IsNotEmpty()
  @IsString()
  storagePath: string;

  @IsNotEmpty()
  @IsUUID()
  documentId: string;
} 