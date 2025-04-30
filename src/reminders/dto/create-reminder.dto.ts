import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
  ValidateIf,
  ArrayNotEmpty,
  IsEnum,
} from 'class-validator';

export enum FrequencyType {
  DAILY = 'daily',
  SPECIFIC_DAYS = 'specific_days',
  INTERVAL = 'interval',
  AS_NEEDED = 'as_needed',
}

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format

export class CreateReminderDto {
  @ApiProperty({ description: 'Title of the reminder', example: 'Take Vitamin D' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Optional notes for the reminder' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: FrequencyType, description: 'How often the reminder repeats' })
  @IsEnum(FrequencyType)
  frequency_type: FrequencyType;

  @ApiProperty({ description: 'Array of times (HH:MM) for the reminder', type: [String], example: ['08:00', '20:00'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(timeRegex, { each: true, message: 'Each time must be in HH:MM format' })
  times_of_day: string[]; // Stored as time[] in DB, but validate as string HH:MM

  @ApiPropertyOptional({
    description: 'Days of the week (0-6, Sun-Sat) if frequency is specific_days',
    type: [Number],
    example: [1, 3, 5],
  })
  @ValidateIf(o => o.frequency_type === FrequencyType.SPECIFIC_DAYS)
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days_of_week?: number[];

  @ApiPropertyOptional({
    description: 'Interval in days if frequency is interval',
    example: 3,
  })
  @ValidateIf(o => o.frequency_type === FrequencyType.INTERVAL)
  @IsInt()
  @Min(1)
  interval_days?: number;

  @ApiProperty({ description: 'Start date for the reminder', example: '2024-06-15' })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({ description: 'Optional end date for the reminder', example: '2024-12-31' })
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Whether the reminder is active', default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
} 