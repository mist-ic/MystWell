import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  IsDefined,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format

// --- Nested DTO for Schedule Time/Days ---
export class ScheduleDto {
  @ApiProperty({ description: 'Time of day for the dose (HH:MM)', example: '08:00' })
  @IsString()
  @Matches(timeRegex, { message: 'Time must be in HH:MM format' })
  time_of_day: string;

  @ApiPropertyOptional({
    description: 'Days of the week (1=Sunday, ..., 7=Saturday) if schedule is weekly/specific days.',
    example: [1, 3, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days_of_week?: number[]; // Only relevant for weekly schedules, maybe make required based on parent frequency?

  @ApiProperty({
    description: 'Dosage amount/quantity for this specific time (e.g., number of tablets)',
    example: 1,
  })
  @IsNumber()
  @Min(0) // Allow 0 if needed?
  dosage_amount: number;
}

// --- Main DTO for Creating a Prescription ---
export class CreatePrescriptionDto {
  // --- Medicine Details (Find or Create) ---
  @ApiProperty({ description: 'Name of the medicine', example: 'Metformin' })
  @IsString()
  @IsNotEmpty()
  medicine_name: string;

  @ApiPropertyOptional({
    description: 'Dosage strength (e.g., "500mg")',
    example: '500mg',
  })
  @IsString()
  @IsOptional()
  medicine_dosage?: string;

  @ApiPropertyOptional({
    description: 'Form of the medicine (e.g., "tablet", "capsule", "liquid")',
    example: 'tablet',
  })
  @IsString()
  @IsOptional()
  medicine_form?: string;

  @ApiPropertyOptional({
    description: 'Unit for the dosage (e.g., "mg", "ml")',
    example: 'mg',
  })
  @IsString()
  @IsOptional()
  medicine_unit?: string;

  // --- Prescription Details ---
  @ApiProperty({ description: 'Start date of the prescription', example: '2024-01-15' })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({
    description: 'Optional end date of the prescription',
    example: '2024-07-15',
  })
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Notes about the prescription',
    example: 'Take with meals.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Inventory count (e.g., "30 tablets", "1 bottle")',
    example: '90 tablets remaining',
  })
  @IsString()
  @IsOptional()
  inventory_count?: string;

  // --- Schedule Details ---
  // For simplicity, we take an array of schedule objects directly
  // UI will need to construct this array based on user frequency input
  @ApiProperty({
    description: 'Array of specific schedules (times, days, amounts)',
    type: [ScheduleDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto) // Important for nested validation
  schedules: ScheduleDto[];

  // profile_id will be added in the service based on the authenticated user
} 