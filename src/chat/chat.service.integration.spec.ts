import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatService } from './chat.service';
import { DocumentService } from '../document/document.service';
import { SUPABASE_SERVICE_ROLE_CLIENT } from '../supabase/supabase.module';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

// Mock implementations

// Specific mock for the object returned by from('chat_messages')
const mockChatMessagesTable = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }), // Mock insert success directly here
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }), // For getChatHistory
};

const mockSupabaseAdminClient = {
  from: jest.fn().mockImplementation((tableName: string) => {
    if (tableName === 'chat_messages') {
        // Always return the dedicated mock for this table
        return mockChatMessagesTable;
    }
    // Fallback for other tables if necessary (can be simplified if only chat_messages is used)
    return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null }),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        rpc: jest.fn(),
    };
  }),
  // Keep rpc if needed elsewhere, otherwise can remove if only 'from' is used by ChatService
  rpc: jest.fn(), 
};

const mockDocumentService = {
  findRelevantDocuments: jest.fn(),
  getDocumentDetails: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'GOOGLE_GEMINI_API_KEY') return 'test-api-key';
    return null;
  }),
};

// Mock the generative model and its methods
const mockGenerativeModel = {
    embedContent: jest.fn(),
    generateContent: jest.fn(),
    startChat: jest.fn().mockReturnThis(), // For the old getChatSessionWithHistory if needed
    sendMessage: jest.fn(), // For the old getChatSessionWithHistory if needed
};

// Explicitly type the mock function to accept arguments
type GetGenerativeModelMock = jest.Mock<any, [{ model: string; generationConfig?: any; safetySettings?: any; tools?: any; toolConfig?: any; systemInstruction?: any; }]>;

const mockGoogleGenerativeAI = {
    // Use the explicit type for the mock
    getGenerativeModel: jest.fn() as GetGenerativeModelMock,
};


describe('ChatService Integration Tests', () => {
  let service: ChatService;
  let documentService: DocumentService;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset the dedicated table mock as well
    Object.values(mockChatMessagesTable).forEach(mockFn => {
        if (jest.isMockFunction(mockFn)) {
            mockFn.mockClear();
        }
    });
    // Reconfigure .from() mock in case it was altered by a previous test
    mockSupabaseAdminClient.from.mockImplementation((tableName: string) => {
      if (tableName === 'chat_messages') {
          return mockChatMessagesTable;
      }
      // Add mock return for getSessionById calls on chat_sessions
      if (tableName === 'chat_sessions') {
          return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({data: {id: 'session-1', profile_id: 'profile-1', title: 'Test'}, error: null})
          }
      }
      return { /* generic fallback */ };
    });
    // Set default behaviors for chat_messages table needed by getChatHistory
    mockChatMessagesTable.select.mockReturnThis();
    mockChatMessagesTable.eq.mockReturnThis();
    mockChatMessagesTable.order.mockReturnThis();
    mockChatMessagesTable.limit.mockResolvedValue({ data: [], error: null });
    // Set default behavior for insert needed by saveChatTurn
    mockChatMessagesTable.insert.mockResolvedValue({ error: null });


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SUPABASE_SERVICE_ROLE_CLIENT,
          useValue: mockSupabaseAdminClient,
        },
        // Mock GoogleGenerativeAI provider - IMPORTANT: Use the actual class as token
        {
            provide: GoogleGenerativeAI,
            useValue: mockGoogleGenerativeAI
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    // Manually set the genAI instance on the service to our mock
    // This bypasses issues with trying to provide/inject the complex GoogleGenerativeAI class directly
    (service as any).genAI = mockGoogleGenerativeAI;
    documentService = module.get<DocumentService>(DocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test Scenario 1: RAG only (no tool call needed) --- 
  it('should retrieve relevant documents, add context, and return LLM response', async () => {
    const sessionId = 'session-1';
    const profileId = 'profile-1';
    const userMessage = 'What were the results of my last lab test?';
    const embedding = [0.1, 0.2, 0.3];
    const relevantDocs = [
        { id: 'doc-1', header_description: 'Lab Report for profile-1 on 2024-04-27: Blood test results, high cholesterol noted.', similarity: 0.85 },
    ];
    const llmResponseText = 'Your last lab report (doc-1) from 2024-04-27 showed high cholesterol.';

    // --- Refactored Mocking ---
    mockGoogleGenerativeAI.getGenerativeModel.mockImplementation(({ model }) => {
        if (model.includes('embedding')) { // Check if it's the embedding model request
             return {
                embedContent: jest.fn().mockResolvedValue({ embedding: { values: embedding } }),
                // Add dummy mocks for unused methods
                generateContent: jest.fn(), 
                startChat: jest.fn(),
                sendMessage: jest.fn(),
             };
        } else { // Assume it's the chat model request
             return {
                generateContent: jest.fn().mockResolvedValue({
                    // Ensure the top-level structure matches GenerateContentResult
                    response: {
                        // Ensure candidates is an array
                        candidates: [
                            {
                                // Ensure content object exists
                                content: {
                                    role: 'model',
                                    // Ensure parts is an array containing the text part
                                    parts: [{ text: llmResponseText }],
                                },
                                // Provide other expected fields on the candidate
                                finishReason: 'STOP', // Use the actual enum if available/imported, else string
                                index: 0,
                                safetyRatings: [],
                                citationMetadata: undefined, // Or null if appropriate
                            }
                        ],
                        // Provide other expected fields on the response
                        promptFeedback: undefined, // Or null
                        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
                    }
                }),
                // Add dummy mocks for unused methods
                embedContent: jest.fn(),
                startChat: jest.fn(),
                sendMessage: jest.fn(),
             };
        }
    });
    // --- End Refactored Mocking ---
    
    // Mock document search (remains the same)
    mockDocumentService.findRelevantDocuments.mockResolvedValue(relevantDocs);
    
    const result = await service.sendMessage(sessionId, profileId, userMessage);

    // --- Revised Verification --- 
    // 1. Check getGenerativeModel calls
    const calls = mockGoogleGenerativeAI.getGenerativeModel.mock.calls;
    expect(calls).toHaveLength(2);
    const results = mockGoogleGenerativeAI.getGenerativeModel.mock.results;

    // 2. Find the EMBEDDING model call and its result
    const embeddingCallIndex = calls.findIndex(callArgs => callArgs[0]?.model?.includes('embedding'));
    expect(embeddingCallIndex).toBeGreaterThan(-1); // Ensure embedding model was requested
    expect(calls[embeddingCallIndex][0]).toEqual(expect.objectContaining({ model: expect.stringContaining('embedding') }));
    const embeddingModelInstance = results[embeddingCallIndex].value;
    expect(embeddingModelInstance.embedContent).toHaveBeenCalledTimes(1);
    expect(embeddingModelInstance.generateContent).not.toHaveBeenCalled(); // Ensure chat method wasn't called on embedding model

    // 3. Verify document search occurred *after* embedding
    expect(mockDocumentService.findRelevantDocuments).toHaveBeenCalledWith(profileId, embedding, 3, 0.7);
    // Optional: Check call order if necessary using mock.invocationCallOrder

    // 4. Find the CHAT model call and its result
    const chatCallIndex = calls.findIndex(callArgs => callArgs[0]?.model && !callArgs[0].model.includes('embedding'));
    expect(chatCallIndex).toBeGreaterThan(-1); // Ensure chat model was requested
    expect(calls[chatCallIndex][0]).toEqual(expect.objectContaining({ model: expect.not.stringContaining('embedding') }));
    const chatModelInstance = results[chatCallIndex].value;
    expect(chatModelInstance.generateContent).toHaveBeenCalledTimes(1);
    expect(chatModelInstance.embedContent).not.toHaveBeenCalled(); // Ensure embedding method wasn't called on chat model

    // 5. Check the arguments passed to the chat model's generateContent
    const generateContentCallArgs = chatModelInstance.generateContent.mock.calls[0][0]; // { contents: [...] }
    expect(generateContentCallArgs.contents).toBeDefined();
    const lastContent = generateContentCallArgs.contents[generateContentCallArgs.contents.length - 1];
    expect(lastContent.role).toBe('user');
    expect(lastContent.parts[0].text).toContain(userMessage);
    expect(lastContent.parts[0].text).toContain('Relevant User Documents:');
    expect(lastContent.parts[0].text).toContain(relevantDocs[0].id);
    expect(lastContent.parts[0].text).toContain(relevantDocs[0].header_description);

    // 6. Check final result and database save (using the dedicated mock)
    expect(result).toBe(llmResponseText);
    expect(mockSupabaseAdminClient.from).toHaveBeenCalledWith('chat_messages');
    // Assert directly on the dedicated mock object
    expect(mockChatMessagesTable.insert).toHaveBeenCalledTimes(1);
    // Check the arguments passed to insert
    expect(mockChatMessagesTable.insert).toHaveBeenCalledWith([
      expect.objectContaining({ session_id: sessionId, role: 'user', content: userMessage }),
      expect.objectContaining({ session_id: sessionId, role: 'model', content: llmResponseText })
    ]);
    // --- End Revised Verification --- 
  });

  // --- Test Scenario 2: RAG + Tool Call Success --- 
  it('should handle function call to getDocumentContent and return informed response', async () => {
    const sessionId = 'session-2';
    const profileId = 'profile-2';
    const userMessage = 'Tell me more about document doc-lab-report';
    const documentIdToFetch = 'doc-lab-report';
    const embedding = [0.4, 0.5, 0.6];
    const relevantDocs = [
        { id: documentIdToFetch, header_description: 'Lab Report for profile-2 on 2024-04-28: CBC results within normal range.', similarity: 0.9 },
    ];
    const functionCall = { name: 'getDocumentContent', args: { documentId: documentIdToFetch } };
    const documentDetails = { cholesterol: 180, glucose: 95, report_notes: 'All values nominal.' };
    const finalLlmResponseText = 'The lab report doc-lab-report shows Cholesterol: 180, Glucose: 95. Report notes: All values nominal.';

    // --- Revised Mocking Strategy for Sequential Calls ---
    // Mock object for the chat model instance
    const mockChatModelInstance = {
        generateContent: jest.fn()
            // First call returns function call
            .mockResolvedValueOnce({ 
                response: { 
                    candidates: [{ 
                        content: { parts: [{ functionCall: functionCall }], role: 'model' },
                        finishReason: 'TOOL_CALLING', index: 0, safetyRatings: []
                    }],
                    promptFeedback: null
                }
            })
            // Second call returns final text
            .mockResolvedValue({ 
                response: { 
                    candidates: [{ 
                        content: { parts: [{ text: finalLlmResponseText }], role: 'model' },
                        finishReason: 'STOP', index: 0, safetyRatings: []
                    }],
                    promptFeedback: null
                }
            }),
        // Dummy methods
        embedContent: jest.fn(), 
        startChat: jest.fn(), 
        sendMessage: jest.fn(),
    };

    mockGoogleGenerativeAI.getGenerativeModel.mockImplementation(({ model }) => {
        if (model.includes('embedding')) {
             return { // Embedding Model Mock
                embedContent: jest.fn().mockResolvedValue({ embedding: { values: embedding } }),
                generateContent: jest.fn(), startChat: jest.fn(), sendMessage: jest.fn(),
             };
        } else { // Chat Model Request
            // Return the single instance configured for sequential calls
            return mockChatModelInstance;
        }
    });
    // --- End Revised Mocking Strategy ---

    // Mock DocumentService (RAG + Tool execution)
    mockDocumentService.findRelevantDocuments.mockResolvedValue(relevantDocs);
    mockDocumentService.getDocumentDetails.mockResolvedValue({ 
        id: documentIdToFetch, profile_id: profileId, structured_data: documentDetails, 
        storage_path: '', status: '', created_at: '', updated_at: '',
    });
    // Mock getChatHistory call specifically
    mockChatMessagesTable.limit.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.sendMessage(sessionId, profileId, userMessage);

    // --- Verification ---
    // Check calls
    const calls = mockGoogleGenerativeAI.getGenerativeModel.mock.calls;
    // Now expecting only 2 calls: 1 embedding, 1 chat
    expect(mockGoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledTimes(2); 
    expect(mockDocumentService.findRelevantDocuments).toHaveBeenCalledTimes(1);
    expect(mockDocumentService.getDocumentDetails).toHaveBeenCalledWith(profileId, documentIdToFetch);
    
    // Verify generateContent was called twice *on the same chat model instance*
    expect(mockChatModelInstance.generateContent).toHaveBeenCalledTimes(2); 
    
    // Check the arguments of the second call to generateContent
    const secondCallArgs = mockChatModelInstance.generateContent.mock.calls[1][0];
    const functionResponsePart = secondCallArgs.contents.find(c => c.role === 'function');
    expect(functionResponsePart).toBeDefined();
    expect(functionResponsePart.parts[0].functionResponse.name).toBe('getDocumentContent');
    expect(functionResponsePart.parts[0].functionResponse.response.success).toBe(true);
    expect(functionResponsePart.parts[0].functionResponse.response.content).toEqual(documentDetails);

    // Check final result and DB save
    expect(result).toBe(finalLlmResponseText);
    expect(mockSupabaseAdminClient.from).toHaveBeenCalledWith('chat_messages');
    expect(mockChatMessagesTable.insert).toHaveBeenCalledTimes(1);
  });

  // --- Test Scenario 3: RAG + Tool Call Not Found --- 
  it('should handle function call when document is not found', async () => {
    const sessionId = 'session-3';
    const profileId = 'profile-3';
    const userMessage = 'Get document doc-does-not-exist';
    const documentIdToFetch = 'doc-does-not-exist';
    const embedding = [0.7, 0.8, 0.9];
    const relevantDocs = [
        { id: 'doc-other', header_description: 'Another document description', similarity: 0.8 },
    ];
    const functionCall = { name: 'getDocumentContent', args: { documentId: documentIdToFetch } };
    const finalLlmResponseText = 'Sorry, I could not find a document with the ID doc-does-not-exist.';

    // --- Revised Mocking Strategy for Sequential Calls ---
     const mockChatModelInstanceScenario3 = {
        generateContent: jest.fn()
            // First call returns function call
            .mockResolvedValueOnce({ 
                response: { 
                    candidates: [{ 
                        content: { parts: [{ functionCall: functionCall }], role: 'model' },
                        finishReason: 'TOOL_CALLING', index: 0, safetyRatings: []
                    }],
                    promptFeedback: null
                }
            })
            // Second call returns final error text
            .mockResolvedValue({ 
                 response: { 
                    candidates: [{ 
                        content: { parts: [{ text: finalLlmResponseText }], role: 'model' },
                        finishReason: 'STOP', index: 0, safetyRatings: []
                    }],
                    promptFeedback: null
                }
            }),
        // Dummy methods
        embedContent: jest.fn(), startChat: jest.fn(), sendMessage: jest.fn(),
    };

    mockGoogleGenerativeAI.getGenerativeModel.mockImplementation(({ model }) => {
        if (model.includes('embedding')) {
            return { // Embedding Model Mock
                embedContent: jest.fn().mockResolvedValue({ embedding: { values: embedding } }),
                generateContent: jest.fn(), startChat: jest.fn(), sendMessage: jest.fn(),
             };
        } else { // Chat Model Request
            // Return the single instance configured for sequential calls
            return mockChatModelInstanceScenario3;
        }
    });
    // --- End Revised Mocking Strategy ---

    // Mock DocumentService (RAG + Tool execution fails)
    mockDocumentService.findRelevantDocuments.mockResolvedValue(relevantDocs);
    mockDocumentService.getDocumentDetails.mockRejectedValue(new NotFoundException(`Document with ID ${documentIdToFetch} not found.`));
    // Mock getChatHistory call specifically
    mockChatMessagesTable.limit.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.sendMessage(sessionId, profileId, userMessage);

    // --- Verification ---
    const calls = mockGoogleGenerativeAI.getGenerativeModel.mock.calls; 
    expect(mockDocumentService.findRelevantDocuments).toHaveBeenCalledTimes(1);
    expect(mockDocumentService.getDocumentDetails).toHaveBeenCalledWith(profileId, documentIdToFetch);
    // Expecting 2 calls: 1 embedding, 1 chat
    expect(mockGoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledTimes(2); 

    // Verify generateContent was called twice *on the same chat model instance*
    expect(mockChatModelInstanceScenario3.generateContent).toHaveBeenCalledTimes(2);

    // Check the function response sent back to the model indicates failure
    const secondCallArgsScenario3 = mockChatModelInstanceScenario3.generateContent.mock.calls[1][0];
    const functionResponsePartScenario3 = secondCallArgsScenario3.contents.find(c => c.role === 'function');
    expect(functionResponsePartScenario3.parts[0].functionResponse.response.success).toBe(false);
    expect(functionResponsePartScenario3.parts[0].functionResponse.response.error).toContain('not found');

    // Check final result and DB save
    expect(result).toBe(finalLlmResponseText);
    expect(mockSupabaseAdminClient.from).toHaveBeenCalledWith('chat_messages');
    expect(mockChatMessagesTable.insert).toHaveBeenCalledTimes(1);
  });

   // --- Test Scenario 4: No Relevant Docs --- 
  it('should respond without document context if none are found', async () => {
    const sessionId = 'session-4';
    const profileId = 'profile-4';
    const userMessage = 'Any updates on my insurance?';
    const embedding = [0.1, 0.1, 0.1];
    const llmResponseText = 'I couldn\'t find any specific documents related to insurance updates in your records. Could you provide more details?';

    // --- Refactored Mocking ---
    mockGoogleGenerativeAI.getGenerativeModel.mockImplementation(({ model }) => {
        if (model.includes('embedding')) { 
             return { // Embedding Model Mock
                embedContent: jest.fn().mockResolvedValue({ embedding: { values: embedding } }),
                generateContent: jest.fn(), startChat: jest.fn(), sendMessage: jest.fn(),
             };
        } else { // Chat Model Mock
            return {
                generateContent: jest.fn().mockResolvedValue({ 
                    response: { 
                        candidates: [{ 
                            content: { parts: [{ text: llmResponseText }], role: 'model' },
                            finishReason: 'STOP', index: 0, safetyRatings: []
                        }],
                        promptFeedback: null
                    }
                }),
                embedContent: jest.fn(), startChat: jest.fn(), sendMessage: jest.fn(),
            };
        }
    });
    // --- End Refactored Mocking ---

    // Mock DocumentService (RAG returns empty)
    mockDocumentService.findRelevantDocuments.mockResolvedValue([]);
    // Mock getChatHistory call specifically
    mockChatMessagesTable.limit.mockResolvedValueOnce({ data: [], error: null });

    const result = await service.sendMessage(sessionId, profileId, userMessage);

    // --- Verification ---
    const calls = mockGoogleGenerativeAI.getGenerativeModel.mock.calls;
    expect(mockDocumentService.findRelevantDocuments).toHaveBeenCalledWith(profileId, embedding, 3, 0.7);
    expect(mockGoogleGenerativeAI.getGenerativeModel).toHaveBeenCalledTimes(2); // Embedding + Chat

    // Verify generateContent was called once on the chat model instance
    const chatModelInstancesScenario4 = mockGoogleGenerativeAI.getGenerativeModel.mock.results
                                .filter(r => r.type === 'return' && r.value?.generateContent && !calls[mockGoogleGenerativeAI.getGenerativeModel.mock.results.indexOf(r)][0]?.model?.includes('embedding'))
                                .map(r => r.value);
    expect(chatModelInstancesScenario4).toHaveLength(1);
    expect(chatModelInstancesScenario4[0].generateContent).toHaveBeenCalledTimes(1);
    
    // Check context sent to model does NOT contain the relevant docs header
    const generateContentCallArgsScenario4 = chatModelInstancesScenario4[0].generateContent.mock.calls[0][0];
    const lastContentScenario4 = generateContentCallArgsScenario4.contents[generateContentCallArgsScenario4.contents.length - 1];
    expect(lastContentScenario4.parts[0].text).not.toContain('Relevant User Documents:');
    
    // Check final result and DB save
    expect(result).toBe(llmResponseText);
    expect(mockSupabaseAdminClient.from).toHaveBeenCalledWith('chat_messages');
    expect(mockChatMessagesTable.insert).toHaveBeenCalledTimes(1);
  });

  // TODO: Add tests for embedding failure, safety blocks etc. if needed

}); 