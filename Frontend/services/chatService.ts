import { Platform } from 'react-native';
import { supabase } from '../lib/supabase'; // Assuming supabase client is exported from here
import { getBaseUrl } from './utils'; // Helper to get API base URL

// Type for messages sent/received from the backend API
// Matches the Content type from @google/generative-ai SDK used in backend
interface ApiChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const API_URL = getBaseUrl();

/**
 * Sends a message and history to the backend chat endpoint.
 * @param message The user's message text.
 * @param history The conversation history.
 * @returns The AI model's response text.
 */
export const sendMessageToMist = async (
  message: string,
  history: ApiChatMessage[],
): Promise<string> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    console.error('Error getting session or no active session:', sessionError);
    throw new Error('User not authenticated');
  }

  const token = sessionData.session.access_token;

  try {
    const response = await fetch(`${API_URL}/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // Add platform header if used by backend
        'X-Platform': Platform.OS,
      },
      body: JSON.stringify({ message, history }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Backend error:', response.status, responseData);
      throw new Error(responseData.message || 'Failed to send message to backend');
    }

    if (!responseData.response) {
        console.error("Backend response missing 'response' field:", responseData);
        throw new Error('Invalid response format from backend');
    }

    return responseData.response;
  } catch (error) {
    console.error('Error sending message to Mist:', error);
    // Re-throw the error to be handled by the calling component
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error('An unknown error occurred during the API call.');
    }
  }
}; 