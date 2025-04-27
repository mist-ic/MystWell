import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentRequest,
  Content,
  GenerationConfig,
  ChatSession
} from '@google/generative-ai';

// Simple in-memory store for chat histories. Keyed by a session identifier.
// TODO: Replace with a more persistent solution (e.g., Redis, Supabase) for production.
const chatHistories: Record<string, Content[]> = {};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private modelId = 'gemini-2.0-flash';
  private readonly systemInstruction = {
    role: 'system',
    parts: [
      { text: "You are Mist, a friendly and helpful AI health assistant created by MystWell. Your goal is to provide informative and supportive answers to health-related questions. Prioritize safety, accuracy, and empathy. Do not provide medical diagnoses or prescribe treatments. If asked for a diagnosis or treatment, advise the user to consult a qualified healthcare professional. Keep responses concise and easy to understand. the user knows that you are an ai so no need to tell them agaon and again if a user asks u somehitng you tell thenm A solution on what to do and suggest them commmon otc treat them like you patient ask them question and work nicely ask them question know the problem and suggest them a solution  " }
    ]
  };

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GOOGLE_GEMINI_API_KEY is not configured.');
      throw new Error('Gemini API key configuration is missing.');
    }
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(`Gemini client initialized for model: ${this.modelId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  // Basic session management - uses a simple identifier (e.g., could be userId)
  // In a real app, manage sessions more robustly.
  private getChatSession(sessionId: string): ChatSession {
     const model = this.genAI.getGenerativeModel({ 
       model: this.modelId,
       systemInstruction: this.systemInstruction, // Apply system instruction
       safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
           // Consider adding HARM_CATEGORY_MEDICAL based on use case sensitivity
           // {
           //  category: HarmCategory.HARM_CATEGORY_MEDICAL,
           //  threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
           // },
       ]
     });

     // Retrieve history or start new
     const history = chatHistories[sessionId] || [];
     const chat = model.startChat({ history });
     this.logger.debug(`Chat session started/resumed for session: ${sessionId} with ${history.length} history items.`);
     return chat;
  }

  private saveChatHistory(sessionId: string, history: Content[]): void {
      // Limit history length to prevent excessive token usage/cost
      const maxHistoryLength = 20; // Keep last 10 user/model pairs
      chatHistories[sessionId] = history.slice(-maxHistoryLength);
      this.logger.debug(`Saved ${chatHistories[sessionId].length} history items for session: ${sessionId}`);
  }

  async sendMessage(sessionId: string, userMessage: string): Promise<string> {
    this.logger.log(`Received message for session ${sessionId}: ${userMessage}`);

    if (!userMessage || userMessage.trim().length === 0) {
        this.logger.warn(`Empty message received for session ${sessionId}.`);
        return "Please provide a message.";
    }

    try {
      const chat = this.getChatSession(sessionId);
      const result = await chat.sendMessage(userMessage);
      const response = result.response;

      if (!response) {
         this.logger.error('Chatbot error: No response received from Gemini.');
         throw new Error('No response received from Gemini');
      }

      // Check for safety blocks
      if (response.promptFeedback?.blockReason) {
        this.logger.warn(`Message blocked for session ${sessionId}. Reason: ${response.promptFeedback.blockReason}`);
        // You might want to return a generic message or the specific reason depending on policy
        return `I cannot respond to that due to safety guidelines. Reason: ${response.promptFeedback.blockReason}`; 
      }
      
      const botResponse = response.text();
      this.logger.log(`Sending response for session ${sessionId}: ${botResponse}`);

      // Save history after successful interaction
      // Note: The ChatSession object automatically updates its internal history,
      // but we need to persist it externally (to our in-memory store here)
      const updatedHistory = await chat.getHistory();
      this.saveChatHistory(sessionId, updatedHistory);

      return botResponse;

    } catch (error) {
      this.logger.error(
        `Error during chat interaction for session ${sessionId}:`,
        error.message || error,
        error.stack,
      );
      // Log specific Google AI errors if available
      if (error.response && error.response.promptFeedback) {
           this.logger.error('Gemini Prompt Feedback:', error.response.promptFeedback);
      }
      // Provide a user-friendly error message
      return 'Sorry, I encountered an error and could not process your request. Please try again later.';
    }
  }
} 