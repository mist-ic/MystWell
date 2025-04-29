import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { AuthGuard } from '../auth/auth.guard'; // Assuming path to AuthGuard
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Prescriptions') // Group endpoints under 'Prescriptions' tag in Swagger
@ApiBearerAuth() // Indicate that endpoints require Bearer token authentication
@UseGuards(AuthGuard) // Apply AuthGuard to all routes in this controller
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new prescription record' })
  @ApiResponse({
    status: 201,
    description: 'The prescription record has been successfully created.',
    // TODO: Define response type DTO
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 409, description: 'Conflict. Medicine might have been created concurrently.' })
  create(@Body() createPrescriptionDto: CreatePrescriptionDto, @Request() req) {
    // Assuming AuthGuard adds user object with id (supabase user id)
    const userId = req.user?.id;
    if (!userId) {
        throw new Error('User ID not found on request object after AuthGuard'); // Should not happen
    }
    return this.prescriptionService.createPrescription(createPrescriptionDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all prescription records for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of prescription records.',
    // TODO: Define response type DTO array
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  findAll(@Request() req) {
    const userId = req.user?.id;
     if (!userId) {
        throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.prescriptionService.findAllPrescriptions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific prescription record by ID' })
  @ApiParam({ name: 'id', description: 'Prescription UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'The prescription record.',
     // TODO: Define response type DTO
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Prescription not found or not accessible.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
     const userId = req.user?.id;
      if (!userId) {
        throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.prescriptionService.findOnePrescription(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a prescription record by ID' })
  @ApiParam({ name: 'id', description: 'Prescription UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'The updated prescription record.',
     // TODO: Define response type DTO
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Prescription not found or not accessible.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
    @Request() req,
  ) {
    const userId = req.user?.id;
     if (!userId) {
        throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.prescriptionService.updatePrescription(id, updatePrescriptionDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 on successful deletion
  @ApiOperation({ summary: 'Delete a prescription record by ID' })
  @ApiParam({ name: 'id', description: 'Prescription UUID', type: String })
  @ApiResponse({ status: 204, description: 'Prescription successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Prescription not found or not accessible.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
     const userId = req.user?.id;
      if (!userId) {
        throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.prescriptionService.removePrescription(id, userId);
  }
}
