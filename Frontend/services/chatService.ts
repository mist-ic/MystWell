import { Session } from '@supabase/supabase-js';

// Define the structure of the API response
interface ChatResponse {
  reply: string;
}

// Define the structure of the API error response (adjust as needed based on backend)
interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL; // Ensure this is set in your .env

if (!API_BASE_URL) {
  console.error("Error: EXPO_PUBLIC_API_URL is not defined. Please set it in your .env file.");
  // Optionally throw an error or provide a default for local dev, but erroring is safer
  // throw new Error("EXPO_PUBLIC_API_URL is not defined.");
}

/**
 * Sends a message to the backend chat API.
 * 
 * @param message The user's message text.
 * @param session The current Supabase session containing the auth token.
 * @returns A promise that resolves with the AI's reply string.
 * @throws An error if the API call fails or returns an error status.
 */
export const sendMessage = async (message: string, session: Session | null): Promise<string> => {
  if (!session) {
    throw new Error('Authentication required. No active session found.');
  }

  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured.');
  }

  const url = `${API_BASE_URL}/chat/send`;
  const token = session.access_token;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      // Attempt to parse error details from the backend response
      const errorData = responseBody as ApiError;
      const errorMessage = errorData.message 
        ? (Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message)
        : `API Error: ${response.status} ${response.statusText}`;
      console.error('Chat API Error:', errorMessage, 'Status:', response.status, 'Response Body:', responseBody);
      throw new Error(errorMessage);
    }

    // Assuming the backend returns { reply: "..." }
    const chatResponse = responseBody as ChatResponse;
    if (typeof chatResponse.reply !== 'string') {
        console.error('Invalid chat response format:', chatResponse);
        throw new Error('Received invalid response format from chat API.');
    }

    return chatResponse.reply;

  } catch (error) {
    console.error('Error sending chat message:', error);
    // Re-throw the error to be caught by the calling component
    // The component can then decide how to display the error (e.g., Snackbar)
    throw error; 
  }
}; 