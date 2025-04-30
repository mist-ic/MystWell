import { Test, TestingModule } from '@nestjs/testing';
import { RemindersService } from './reminders.service';
import { ProfileService } from '../profile/profile.service';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import {
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateReminderDto, FrequencyType } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

// Define the structure of the mock results for clarity
const mockSuccess = (data: any) => ({ data, error: null });
// Define structure for mock errors mimicking Supabase
const mockError = (message: string, code: string = 'MOCK_ERROR', details: string | null = null) => ({ data: null, error: { message, code, details } });

// Create mocks for the final PROMISE results
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(); // Mock for the array result of select
const mockDeleteInner = jest.fn(); // Mock the final execution of delete

// Mock Supabase Client
const mockSupabaseClient = {
  // from() returns an object with chainable methods
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    // delete() returns an object that allows eq() and then resolves with mockDeleteInner
    delete: jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
      // The actual promise resolution for delete:
      then: (resolve: (value: any) => void, reject: (reason?: any) => void) => {
        mockDeleteInner().then(resolve, reject);
      }
    })),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    // Terminal methods return the result of the core mocks
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    // General promise resolution (for select etc.) uses mockSelect
    then: (resolve: (value: any) => void, reject: (reason?: any) => void) => {
        mockSelect().then(resolve, reject);
      }
  })),
  // rpc: mockRpc, // removed for now
};

// Mock Profile Service
const mockProfileService = {
  getProfileByUserId: jest.fn(),
};

// Sample Data
const mockUserId = 'auth-user-id-123';
const mockProfileId = 'profile-uuid-456';
const mockReminderId = 'reminder-uuid-789';

const mockReminder = {
  id: mockReminderId,
  profile_id: mockProfileId,
  title: 'Test Reminder',
  notes: 'Test notes',
  frequency_type: 'daily',
  times_of_day: ['09:00'],
  days_of_week: null,
  interval_days: null,
  start_date: '2024-01-01',
  end_date: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('RemindersService', () => {
  let service: RemindersService;
  let supabase: SupabaseClient;
  let profileService: ProfileService;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        {
          provide: ProfileService,
          useValue: mockProfileService,
        },
        {
          provide: SUPABASE_SERVICE_ROLE_CLIENT,
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
    supabase = module.get<SupabaseClient>(SUPABASE_SERVICE_ROLE_CLIENT);
    profileService = module.get<ProfileService>(ProfileService);

    // Default mock implementations - Ensure they return PROMISES
    mockProfileService.getProfileByUserId.mockResolvedValue({ id: mockProfileId });
    mockSingle.mockResolvedValue(mockSuccess(mockReminder));
    mockMaybeSingle.mockResolvedValue(mockSuccess(mockReminder));
    mockSelect.mockResolvedValue(mockSuccess([mockReminder]));
    mockDeleteInner.mockResolvedValue(mockSuccess(null)); 
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- getProfileIdOrThrow --- (tested implicitly below, but can add specific tests)
  describe('getProfileIdOrThrow', () => {
    it('should return profileId if profile exists', async () => {
      await expect((service as any).getProfileIdOrThrow(mockUserId)).resolves.toEqual(mockProfileId);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw ForbiddenException if profile does not exist', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValueOnce(null);
      await expect((service as any).getProfileIdOrThrow(mockUserId)).rejects.toThrow(ForbiddenException);
    });
  });

  // --- createReminder --- 
  describe('createReminder', () => {
    const createDto: CreateReminderDto = {
      title: 'New Reminder',
      frequency_type: FrequencyType.DAILY,
      times_of_day: ['10:00'],
      start_date: '2024-01-01',
    };

    it('should create and return a reminder', async () => {
      // No need to prime mocks here if default is success
      const result = await service.createReminder(createDto, mockUserId);
      expect(result).toEqual(mockReminder);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reminders');

      // Check the final mock was called
      expect(mockSingle).toHaveBeenCalledTimes(1);
    });

    it('should throw ForbiddenException if profile not found', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValueOnce(null);
      await expect(service.createReminder(createDto, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw InternalServerErrorException on Supabase insert error', async () => {
      mockSingle.mockResolvedValueOnce(mockError('DB insert error', '23505')); 
      await expect(service.createReminder(createDto, mockUserId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // --- findAllReminders ---
  describe('findAllReminders', () => {
    it('should return an array of reminders', async () => {
      // No need to prime mocks here if default is success
      const result = await service.findAllReminders(mockUserId);
      expect(result).toEqual([mockReminder]);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reminders');

      const mockChain = (mockSupabaseClient.from as jest.Mock).mock.results[0].value;
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('profile_id', mockProfileId);
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      // Check the final mock was called
      expect(mockSelect).toHaveBeenCalledTimes(1); 
    });

    it('should return an empty array if no reminders found', async () => {
      mockSelect.mockResolvedValueOnce(mockSuccess([]));
      const result = await service.findAllReminders(mockUserId);
      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException if profile not found', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValueOnce(null);
      await expect(service.findAllReminders(mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw InternalServerErrorException on Supabase select error', async () => {
      mockSelect.mockResolvedValueOnce(mockError('DB select error')); 
      await expect(service.findAllReminders(mockUserId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // --- findOneReminder ---
  describe('findOneReminder', () => {
    it('should return a single reminder', async () => {
      // No need to prime mocks here if default is success
      const result = await service.findOneReminder(mockReminderId, mockUserId);
      expect(result).toEqual(mockReminder);
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reminders');

      const mockChain = (mockSupabaseClient.from as jest.Mock).mock.results[0].value;
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('id', mockReminderId);
      expect(mockChain.eq).toHaveBeenCalledWith('profile_id', mockProfileId);
      // Check the final mock was called
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if reminder not found', async () => {
      mockMaybeSingle.mockResolvedValueOnce(mockSuccess(null));
      await expect(service.findOneReminder(mockReminderId, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if profile not found', async () => {
      mockProfileService.getProfileByUserId.mockResolvedValueOnce(null);
      await expect(service.findOneReminder(mockReminderId, mockUserId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw InternalServerErrorException on Supabase select error', async () => {
      mockMaybeSingle.mockResolvedValueOnce(mockError('DB error'));
      await expect(service.findOneReminder(mockReminderId, mockUserId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // --- updateReminder ---
  describe('updateReminder', () => {
    const updateDto: UpdateReminderDto = { title: 'Updated Reminder' };

    it('should update and return the reminder', async () => {
      // Default mocks handle findOne success and update success
      const updatedMock = { ...mockReminder, ...updateDto };
      // Override the mock for the update call only
      mockSingle.mockResolvedValueOnce(mockSuccess(updatedMock));
      
      const result = await service.updateReminder(mockReminderId, updateDto, mockUserId);
      
      expect(result.title).toEqual('Updated Reminder');
      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
      // from() is called twice: once for findOne, once for update
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reminders');

      // Check the final mocks were called
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1); // For findOne
      expect(mockSingle).toHaveBeenCalledTimes(1); // For update

      // Check findOne call (uses maybeSingle) - first call to from()
      const findOneChain = (mockSupabaseClient.from as jest.Mock).mock.results[0].value;
      expect(findOneChain.maybeSingle).toHaveBeenCalledTimes(1);

      // Check update call (uses single) - second call to from()
      const updateChain = (mockSupabaseClient.from as jest.Mock).mock.results[1].value;
      expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({
        ...updateDto,
        updated_at: expect.any(String),
      }));
      expect(updateChain.eq).toHaveBeenCalledWith('id', mockReminderId);
      expect(updateChain.select).toHaveBeenCalled();
      expect(updateChain.single).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if reminder to update is not found', async () => {
      mockMaybeSingle.mockResolvedValueOnce(mockSuccess(null));
      await expect(service.updateReminder(mockReminderId, updateDto, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on Supabase update error', async () => {
      mockMaybeSingle.mockResolvedValueOnce(mockSuccess(mockReminder)); // findOne succeeds
      mockSingle.mockResolvedValueOnce(mockError('DB update error')); // update fails
      await expect(service.updateReminder(mockReminderId, updateDto, mockUserId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // --- removeReminder ---
  describe('removeReminder', () => {
    it('should successfully remove a reminder', async () => {
      // Default mocks handle findOne success and delete success
      await service.removeReminder(mockReminderId, mockUserId);

      expect(mockProfileService.getProfileByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2); // findOne + delete
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reminders');

      // Check the final mocks were called
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1); // For findOne
      expect(mockDeleteInner).toHaveBeenCalledTimes(1); // For delete
    });

    it('should throw NotFoundException if reminder to remove is not found', async () => {
      // Override findOne mock
      mockMaybeSingle.mockResolvedValueOnce(mockSuccess(null));
      await expect(service.removeReminder(mockReminderId, mockUserId)).rejects.toThrow(NotFoundException);
      // Check that delete was NOT called
      expect(mockDeleteInner).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on Supabase delete error', async () => {
      mockMaybeSingle.mockResolvedValueOnce(mockSuccess(mockReminder)); // findOne succeeds
      mockDeleteInner.mockResolvedValueOnce(mockError('DB delete error')); // delete fails
      await expect(service.removeReminder(mockReminderId, mockUserId)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
