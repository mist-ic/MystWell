import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { ProfileService } from '../profile/profile.service';
import { Database } from '../supabase/database.types';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

type Reminder = Database['public']['Tables']['reminders']['Row'];

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT) private readonly supabase: SupabaseClient<Database>,
    private readonly profileService: ProfileService,
  ) {}

  private async getProfileIdOrThrow(userId: string): Promise<string> {
    const profile = await this.profileService.getProfileByUserId(userId);
    if (!profile) {
      this.logger.error(`[RemindersService] Profile not found for user ID: ${userId}`);
      throw new ForbiddenException('User profile not found.');
    }
    return profile.id;
  }

  // --- CRUD operations ---

  async createReminder(createDto: CreateReminderDto, userId: string): Promise<Reminder> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Creating reminder titled "${createDto.title}" for profile ${profileId} (Using Service Role)`);

    const { data, error } = await this.supabase
      .from('reminders')
      .insert({
        profile_id: profileId,
        title: createDto.title,
        notes: createDto.notes,
        frequency_type: createDto.frequency_type,
        times_of_day: createDto.times_of_day, // Assuming DTO provides HH:MM strings
        days_of_week: createDto.days_of_week,
        interval_days: createDto.interval_days,
        start_date: createDto.start_date,
        end_date: createDto.end_date,
        is_active: createDto.is_active,
        // created_at and updated_at have defaults in DB
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create reminder for profile ${profileId}: ${error.message}`,
        error.stack,
      );
      // TODO: Add more specific error handling (e.g., duplicate checks if needed)
      throw new InternalServerErrorException('Could not create reminder.');
    }

    this.logger.log(`Reminder created successfully with ID: ${data.id}`);
    return data;
  }

  async findAllReminders(userId: string): Promise<Reminder[]> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Fetching all reminders for profile ${profileId} (Using Service Role)`);

    const { data, error } = await this.supabase
      .from('reminders')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch reminders for profile ${profileId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not fetch reminders.');
    }

    return data || [];
  }

  async findOneReminder(id: string, userId: string): Promise<Reminder> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Fetching reminder ${id} for profile ${profileId} (Using Service Role)`);

    const { data, error } = await this.supabase
      .from('reminders')
      .select('*')
      .eq('id', id)
      .eq('profile_id', profileId) // RLS also handles this, but explicit check is safer
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch reminder ${id} for profile ${profileId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not fetch reminder.');
    }

    if (!data) {
      this.logger.warn(`Reminder ${id} not found for profile ${profileId}`);
      throw new NotFoundException(`Reminder with ID ${id} not found.`);
    }

    return data;
  }

  async updateReminder(id: string, updateDto: UpdateReminderDto, userId: string): Promise<Reminder> {
    const profileId = await this.getProfileIdOrThrow(userId);
    // Ensure reminder exists and belongs to user before updating
    await this.findOneReminder(id, userId);
    this.logger.log(`Updating reminder ${id} for profile ${profileId} (Using Service Role)`);

    const { data, error } = await this.supabase
      .from('reminders')
      .update({
        ...updateDto,
        updated_at: new Date().toISOString(), // Explicitly set updated_at
      })
      .eq('id', id)
      .eq('profile_id', profileId) // RLS also handles this
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to update reminder ${id} for profile ${profileId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not update reminder.');
    }

    this.logger.log(`Reminder ${id} updated successfully.`);
    return data;
  }

  async removeReminder(id: string, userId: string): Promise<void> {
    const profileId = await this.getProfileIdOrThrow(userId);
    // Ensure reminder exists and belongs to user before attempting delete
    await this.findOneReminder(id, userId);
    this.logger.log(`Removing reminder ${id} for profile ${profileId} (Using Service Role)`);

    const { error } = await this.supabase
      .from('reminders')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId); // RLS also handles this

    if (error) {
      this.logger.error(
        `Failed to delete reminder ${id} for profile ${profileId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not delete reminder.');
    }

    this.logger.log(`Reminder ${id} removed successfully.`);
  }
}
