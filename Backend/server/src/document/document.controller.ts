import { Controller, Post, UseGuards, Req, Get, Param, ParseUUIDPipe, Body, Delete, Put, HttpCode, HttpStatus } from '@nestjs/common';
import { DocumentService, Document } from './document.service';
import { AuthGuard } from '../auth/auth.guard'; // Assuming AuthGuard is in auth module
import { UploadCompleteDto } from './dto/upload-complete.dto';
import { RenameDocumentDto } from './dto/rename-document.dto';

@UseGuards(AuthGuard) // Apply AuthGuard to the entire controller
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // Endpoint to initiate upload: request a signed URL
  @Post('upload-request')
  async getUploadUrl(@Req() req): Promise<{ uploadUrl: string; documentId: string; storagePath: string }> {
    const userId = req.user?.id; // Extract user ID from Supabase user object
    return this.documentService.getUploadDetails(userId);
  }

  // Endpoint to confirm upload completion and trigger processing
  @Post('upload-complete')
  @HttpCode(HttpStatus.OK) // Return 200 OK on success
  async completeUpload(@Req() req, @Body() uploadCompleteDto: UploadCompleteDto): Promise<Document> {
    const userId = req.user?.id;
    // Note: storagePath from DTO might differ slightly if Supabase added file extension
    // We rely on the documentId to find the correct record
    return this.documentService.completeUpload(
      userId, 
      uploadCompleteDto.documentId, 
      uploadCompleteDto.storagePath,
      uploadCompleteDto.displayName
    );
  }

  // Endpoint to get all documents for the user
  @Get()
  async getDocuments(@Req() req): Promise<Document[]> {
    const userId = req.user?.id;
    return this.documentService.getDocuments(userId);
  }

  // Endpoint to get details for a specific document
  @Get(':id')
  async getDocumentDetails(@Req() req, @Param('id', ParseUUIDPipe) id: string): Promise<Document> {
    const userId = req.user?.id;
    return this.documentService.getDocumentDetails(userId, id);
  }

  // Endpoint to get a signed URL for viewing/downloading the original document
  @Get(':id/view-url')
  async getDownloadUrl(@Req() req, @Param('id', ParseUUIDPipe) id: string): Promise<{ downloadUrl: string; mimeType: string | null }> {
    const userId = req.user?.id;
    return this.documentService.getDownloadUrl(userId, id);
  }

  // Endpoint to retry processing for a failed document
  @Post(':id/retry-processing')
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 No Content on success
  async retryProcessing(@Req() req, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = req.user?.id;
    await this.documentService.retryProcessing(userId, id);
  }

  // Endpoint to rename a document
  @Put(':id/rename')
  async renameDocument(
    @Req() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() renameDto: RenameDocumentDto,
  ): Promise<Document> {
    const userId = req.user?.id;
    return this.documentService.renameDocument(userId, id, renameDto);
  }

  // Endpoint to delete a document
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 No Content on success
  async deleteDocument(@Req() req, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const userId = req.user?.id;
    await this.documentService.deleteDocument(userId, id);
  }

  // Test endpoint for verifying request-scoped client
  @Get('test/auth-check')
  async testAuthCheck(@Req() req): Promise<string | null> {
      const userId = req.user?.id;
      return this.documentService.getUserIdFromClient(userId);
  }
} 