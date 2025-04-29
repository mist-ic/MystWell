import { PartialType } from '@nestjs/swagger';
import { CreatePrescriptionDto } from './create-prescription.dto';

// Use PartialType to make all fields from CreatePrescriptionDto optional for updates
// Note: Handling updates to nested schedules might require more specific logic
// depending on whether you want to replace all schedules or patch individual ones.
// For simplicity, this DTO allows partially updating top-level fields and replacing the schedules array.
export class UpdatePrescriptionDto extends PartialType(CreatePrescriptionDto) {} 