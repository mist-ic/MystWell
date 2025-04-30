import { Test, TestingModule } from '@nestjs/testing';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateReminderDto, FrequencyType } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CanActivate, ExecutionContext, ParseUUIDPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';

// Mock Reminders Service
const mockRemindersService = {
  createReminder: jest.fn(),
  findAllReminders: jest.fn(),
  findOneReminder: jest.fn(),
  updateReminder: jest.fn(),
  removeReminder: jest.fn(),
};

// Mock AuthGuard that allows access and provides a mock user
const mockAuthGuard: CanActivate = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  },
};

// Mock ParseUUIDPipe to throw on invalid input
const mockParseUUIDPipe = {
  transform: (value: string, metadata: ArgumentMetadata) => {
    if (value === 'invalid-uuid') { // Only throw for the specific test case
      throw new BadRequestException('Validation failed (uuid is expected)');
    }
    return value; // Return value otherwise
  },
};

// Sample Data
const mockUserId = 'test-user-id';
const mockReminderId = 'reminder-uuid-123';
const mockReminder = {
  id: mockReminderId,
  profile_id: 'profile-id-abc',
  title: 'Test Reminder',
  frequency_type: 'daily',
  times_of_day: ['09:00'],
  start_date: '2024-01-01',
};

describe('RemindersController', () => {
  let controller: RemindersController;
  let service: RemindersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        {
          provide: RemindersService,
          useValue: mockRemindersService,
        },
        // ParseUUIDPipe, // Remove plain provider
        // Instead, override the pipe with our mock
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue(mockAuthGuard)
    // Add overridePipe
    .overridePipe(ParseUUIDPipe)
    .useValue(mockParseUUIDPipe)
    .compile();

    controller = module.get<RemindersController>(RemindersController);
    service = module.get<RemindersService>(RemindersService);

    mockRemindersService.createReminder.mockResolvedValue(mockReminder);
    mockRemindersService.findAllReminders.mockResolvedValue([mockReminder]);
    mockRemindersService.findOneReminder.mockResolvedValue(mockReminder);
    mockRemindersService.updateReminder.mockResolvedValue(mockReminder);
    mockRemindersService.removeReminder.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- POST /reminders --- 
  describe('create', () => {
    const createDto: CreateReminderDto = {
      title: 'New Reminder',
      frequency_type: FrequencyType.DAILY,
      times_of_day: ['10:00'],
      start_date: '2024-01-01',
    };
    const mockRequest = { user: { id: mockUserId } };

    it('should call service.createReminder and return the result', async () => {
      const result = await controller.create(createDto, mockRequest);
      expect(result).toEqual(mockReminder);
      expect(service.createReminder).toHaveBeenCalledWith(createDto, mockUserId);
    });
  });

  // --- GET /reminders --- 
  describe('findAll', () => {
    const mockRequest = { user: { id: mockUserId } };

    it('should call service.findAllReminders and return the result', async () => {
      const result = await controller.findAll(mockRequest);
      expect(result).toEqual([mockReminder]);
      expect(service.findAllReminders).toHaveBeenCalledWith(mockUserId);
    });
  });

  // --- GET /reminders/:id ---
  describe('findOne', () => {
    const mockRequest = { user: { id: mockUserId } };

    it('should call service.findOneReminder and return the result', async () => {
      const result = await controller.findOne(mockReminderId, mockRequest);
      expect(result).toEqual(mockReminder);
      expect(service.findOneReminder).toHaveBeenCalledWith(mockReminderId, mockUserId);
    });
  });

  // --- PATCH /reminders/:id ---
  describe('update', () => {
    const updateDto: UpdateReminderDto = { title: 'Updated Reminder' };
    const mockRequest = { user: { id: mockUserId } };

    it('should call service.updateReminder and return the result', async () => {
      mockRemindersService.updateReminder.mockResolvedValueOnce({ ...mockReminder, ...updateDto });
      const result = await controller.update(mockReminderId, updateDto, mockRequest);
      expect(result.title).toEqual('Updated Reminder');
      expect(service.updateReminder).toHaveBeenCalledWith(mockReminderId, updateDto, mockUserId);
    });
  });

  // --- DELETE /reminders/:id ---
  describe('remove', () => {
    const mockRequest = { user: { id: mockUserId } };

    it('should call service.removeReminder', async () => {
      await controller.remove(mockReminderId, mockRequest);
      expect(service.removeReminder).toHaveBeenCalledWith(mockReminderId, mockUserId);
    });
  });
});
