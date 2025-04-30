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
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { AuthGuard } from '../auth/auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new reminder' })
  @ApiResponse({ status: 201, description: 'Reminder created successfully.' /* TODO: Add type */ })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  create(@Body() createReminderDto: CreateReminderDto, @Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.remindersService.createReminder(createReminderDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reminders for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of reminders.' /* TODO: Add type */ })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  findAll(@Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.remindersService.findAllReminders(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific reminder by ID' })
  @ApiParam({ name: 'id', description: 'Reminder UUID', type: String })
  @ApiResponse({ status: 200, description: 'The reminder record.' /* TODO: Add type */ })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Reminder not found or not accessible.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.remindersService.findOneReminder(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder by ID' })
  @ApiParam({ name: 'id', description: 'Reminder UUID', type: String })
  @ApiResponse({ status: 200, description: 'The updated reminder record.' /* TODO: Add type */ })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Reminder not found or not accessible.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReminderDto: UpdateReminderDto,
    @Request() req,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.remindersService.updateReminder(id, updateReminderDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a reminder by ID' })
  @ApiParam({ name: 'id', description: 'Reminder UUID', type: String })
  @ApiResponse({ status: 204, description: 'Reminder successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User profile not found.' })
  @ApiResponse({ status: 404, description: 'Reminder not found or not accessible.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User ID not found on request object after AuthGuard');
    }
    return this.remindersService.removeReminder(id, userId);
  }
}
