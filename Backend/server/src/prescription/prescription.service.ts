import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { ProfileService } from '../profile/profile.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Database } from '../supabase/database.types';

type Prescription = Database['public']['Tables']['prescriptions']['Row'];
type Medicine = Database['public']['Tables']['medicines']['Row'];
type Schedule = Database['public']['Tables']['medicine_schedules']['Row'];
type ScheduleInsert = Database['public']['Tables']['medicine_schedules']['Insert'];

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient<Database>,
    private readonly profileService: ProfileService,
  ) {}

  private async getProfileIdOrThrow(userId: string): Promise<string> {
    const profile = await this.profileService.getProfileByUserId(userId);
    if (!profile) {
      this.logger.error(`[PrescriptionService] Profile not found for user ID: ${userId}`);
      throw new ForbiddenException('User profile not found.');
    }
    return profile.id;
  }

  private async findOrCreateMedicine(
    details: Pick<
      CreatePrescriptionDto,
      'medicine_name' | 'medicine_dosage' | 'medicine_form' | 'medicine_unit'
    >,
  ): Promise<Medicine> {
    const { medicine_name, medicine_dosage, medicine_form, medicine_unit } = details;
    this.logger.debug(`Finding/creating medicine: ${medicine_name}`);

    const { data: existing, error: findError } = await this.supabase
      .from('medicines')
      .select('*')
      .ilike('name', medicine_name)
      .maybeSingle();

    if (findError) {
      this.logger.error(`Error finding medicine ${medicine_name}: ${findError.message}`);
      throw new InternalServerErrorException('Error checking for existing medicine.');
    }

    if (existing) {
      this.logger.log(`Found existing medicine: ${existing.id}`);
      return existing;
    }

    this.logger.log(`Medicine ${medicine_name} not found, creating new entry.`);
    const { data: created, error: createError } = await this.supabase
      .from('medicines')
      .insert({
        name: medicine_name,
        dosage: medicine_dosage,
        form: medicine_form,
        unit: medicine_unit,
      })
      .select()
      .single();

    if (createError) {
      this.logger.error(`Error creating medicine ${medicine_name}: ${createError.message}`);
      if (createError.code === '23505') {
        throw new ConflictException(`Medicine '${medicine_name}' might have been created concurrently.`);
      }
      throw new InternalServerErrorException('Could not create new medicine.');
    }

    this.logger.log(`Created new medicine: ${created.id}`);
    return created;
  }

  async createPrescription(
    createDto: CreatePrescriptionDto,
    userId: string,
  ): Promise<Prescription & { schedules: Schedule[] }> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Creating prescription for profile ${profileId} by user ${userId}`);

    const medicine = await this.findOrCreateMedicine({
      medicine_name: createDto.medicine_name,
      medicine_dosage: createDto.medicine_dosage,
      medicine_form: createDto.medicine_form,
      medicine_unit: createDto.medicine_unit,
    });

    const { data: prescription, error: presError } = await this.supabase
      .from('prescriptions')
      .insert({
        profile_id: profileId,
        medicine_id: medicine.id,
        start_date: createDto.start_date,
        end_date: createDto.end_date,
        notes: createDto.notes,
        inventory_count: createDto.inventory_count,
      })
      .select()
      .single();

    if (presError) {
      this.logger.error(
        `Failed to create prescription for profile ${profileId}, medicine ${medicine.id}: ${presError.message}`,
      );
      throw new InternalServerErrorException('Could not create prescription record.');
    }
    this.logger.log(`Prescription created: ${prescription.id}`);

    const scheduleInserts: ScheduleInsert[] = createDto.schedules.map(s => ({
      prescription_id: prescription.id,
      time_of_day: s.time_of_day,
      days_of_week: s.days_of_week,
      dosage_amount: s.dosage_amount,
    }));

    const { data: schedules, error: schedError } = await this.supabase
      .from('medicine_schedules')
      .insert(scheduleInserts)
      .select();

    if (schedError) {
      this.logger.error(
        `Failed to create schedules for prescription ${prescription.id}: ${schedError.message}`,
      );
      try {
        await this.supabase.from('prescriptions').delete().eq('id', prescription.id);
        this.logger.warn(`Rolled back prescription ${prescription.id} due to schedule creation failure.`);
      } catch (rollbackError) {
        this.logger.error(`Failed to rollback prescription ${prescription.id}: ${rollbackError.message}`);
      }
      throw new InternalServerErrorException('Could not create schedules.');
    }
    this.logger.log(`Created ${schedules.length} schedules for prescription ${prescription.id}`);

    return { ...prescription, schedules };
  }

  async findAllPrescriptions(userId: string): Promise<(Prescription & { medicine: Medicine, schedules: Schedule[] })[]> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Fetching all prescriptions for profile ${profileId}`);

    const { data, error } = await this.supabase
      .from('prescriptions')
      .select(`
        *,
        medicines (*),
        medicine_schedules (*)
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch prescriptions for profile ${profileId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Could not fetch prescriptions.');
    }

    return (data || []).map(p => ({
        ...p,
        medicine: p.medicines as Medicine,
        schedules: p.medicine_schedules as Schedule[],
    }));
  }

  async findOnePrescription(id: string, userId: string): Promise<Prescription & { medicine: Medicine, schedules: Schedule[] }> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Fetching prescription ${id} for profile ${profileId}`);

    const { data, error } = await this.supabase
      .from('prescriptions')
      .select(`
        *,
        medicines (*),
        medicine_schedules (*)
      `)
      .eq('id', id)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch prescription ${id} for profile ${profileId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Could not fetch prescription.');
    }

    if (!data) {
      throw new NotFoundException(`Prescription with ID ${id} not found or not accessible.`);
    }

     return {
        ...data,
        medicine: data.medicines as Medicine,
        schedules: data.medicine_schedules as Schedule[],
    };
  }

  async updatePrescription(
    id: string,
    updateDto: UpdatePrescriptionDto,
    userId: string,
  ): Promise<Prescription & { medicine: Medicine, schedules: Schedule[] }> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Updating prescription ${id} for profile ${profileId}`);

    const existingPrescription = await this.findOnePrescription(id, userId);

    let medicineId = existingPrescription.medicine_id;
    if (updateDto.medicine_name) {
      const medicine = await this.findOrCreateMedicine({
        medicine_name: updateDto.medicine_name,
        medicine_dosage: updateDto.medicine_dosage,
        medicine_form: updateDto.medicine_form,
        medicine_unit: updateDto.medicine_unit,
      });
      medicineId = medicine.id;
    }

    const { data: updatedPrescription, error: presUpdateError } = await this.supabase
      .from('prescriptions')
      .update({
        medicine_id: medicineId,
        start_date: updateDto.start_date,
        end_date: updateDto.end_date,
        notes: updateDto.notes,
        inventory_count: updateDto.inventory_count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('profile_id', profileId)
      .select()
      .single();

    if (presUpdateError) {
      this.logger.error(`Failed to update prescription ${id}: ${presUpdateError.message}`);
      throw new InternalServerErrorException('Could not update prescription record.');
    }

    let updatedSchedules: Schedule[] = existingPrescription.schedules;
    if (updateDto.schedules && updateDto.schedules.length > 0) {
        this.logger.log(`Replacing schedules for prescription ${id}`);
        const { error: deleteSchedError } = await this.supabase
            .from('medicine_schedules')
            .delete()
            .eq('prescription_id', id);

        if (deleteSchedError) {
            this.logger.error(`Failed to delete old schedules for prescription ${id}: ${deleteSchedError.message}`);
            throw new InternalServerErrorException('Could not delete old schedules during update.');
        }

        const newScheduleInserts: ScheduleInsert[] = updateDto.schedules.map(s => ({
            prescription_id: id,
            time_of_day: s.time_of_day,
            days_of_week: s.days_of_week,
            dosage_amount: s.dosage_amount,
        }));

        const { data: newSchedules, error: insertSchedError } = await this.supabase
            .from('medicine_schedules')
            .insert(newScheduleInserts)
            .select();

        if (insertSchedError) {
            this.logger.error(`Failed to insert new schedules for prescription ${id}: ${insertSchedError.message}`);
            throw new InternalServerErrorException('Could not insert new schedules during update.');
        }
         updatedSchedules = newSchedules;
         this.logger.log(`Inserted ${newSchedules.length} new schedules for prescription ${id}`);
    }

    const { data: finalMedicine } = await this.supabase.from('medicines').select('*').eq('id', medicineId).single();

    return {
        ...updatedPrescription,
        medicine: finalMedicine as Medicine,
        schedules: updatedSchedules,
    };
  }

  async removePrescription(id: string, userId: string): Promise<void> {
    const profileId = await this.getProfileIdOrThrow(userId);
    this.logger.log(`Attempting to remove prescription ${id} for profile ${profileId}`);

    const { error, count } = await this.supabase
      .from('prescriptions')
      .delete()
      .eq('id', id)
      .eq('profile_id', profileId);

    if (error) {
      this.logger.error(
        `Failed to delete prescription ${id} for profile ${profileId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Could not delete prescription.');
    }

    if (count === 0) {
      this.logger.warn(`Prescription ${id} not found or not accessible for deletion by profile ${profileId}`);
      throw new NotFoundException(`Prescription with ID ${id} not found or not accessible.`);
    }

    this.logger.log(`Prescription deleted successfully: ${id}`);
  }
}
