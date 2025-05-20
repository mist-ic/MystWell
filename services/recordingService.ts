import {
  AppError,
  ApiError,
  NetworkError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  handleError // We might not use handleError directly if fetch handling is custom
} from '../utils/errors';

// Placeholder for Recording type - Define based on actual API response
export interface Recording {
  id: string;
  profile_id: string; // Added profile_id if needed by frontend logic
  title: string | null;
  created_at: string; // ISO date string
  updated_at: string; // Added updated_at
  duration: number | null; // in seconds
  summary: string | null; // This likely comes from Gemini analysis
  transcription: string | null; // Original field, might still be used?
  raw_transcript: string | null; // Added raw transcript from Speech-to-Text
  structured_details: any | null; // Added for Gemini analysis results
  storage_path: string; // Added storage path
  status: 
    | 'pending_upload' 
    | 'uploaded' 
    | 'queued' 
    | 'processing' // General processing state
    | 'download_failed'
    | 'transcribing_completed' // Intermediate state
    | 'transcription_failed'
    | 'analysis_failed' // Gemini analysis specific failure
    | 'completed' // Final success state
    | 'failed'; // General failure state
  error?: string | null; // Optional error message if status indicates failure
  metadata?: any | null; // Added metadata field
  // Add any other relevant fields from your backend API
}

// API base URL
// TODO: Consider moving this to a configuration file or environment variable
const API_BASE_URL = 'REDACTED_API_URL'; 

/**
 * Helper to process fetch response and throw appropriate errors.
 */
async function handleFetchResponse<T>(
  response: Response,
  context: string,
  successStatusCode: number = 200 // Expected success status code for GET/POST/PUT
): Promise<T> {
  if (response.ok && response.status === successStatusCode) {
    if (response.status === 204) { // Handle No Content for DELETE success
      return {} as T; // Or undefined, depending on expected return for 204
    }
    try {
      return await response.json() as T;
    } catch (jsonError) {
      console.error(`Error parsing JSON response in ${context}:`, jsonError, await response.text());
      throw new ApiError(
        `InvalidJsonResponseIn${context}`,
        `The server provided an invalid response for ${context}.`,
        jsonError
      );
    }
  }

  let errorData: any = null;
  let errorMessageFromServer = response.statusText || `Failed API call in ${context}`;
  try {
    errorData = await response.json();
    if (errorData && typeof errorData.message === 'string') {
      errorMessageFromServer = errorData.message;
    }
  } catch (e) {
    // Not a JSON error response, or empty. Use statusText or default.
    console.warn(`Could not parse error response as JSON in ${context} (status: ${response.status})`);
  }

  const serviceContext = `in ${context}`;

  switch (response.status) {
    case 400:
      throw new ApiError(
        `BadRequest${context}`,
        `Invalid request ${serviceContext}: ${errorMessageFromServer}`,
        { response, errorData }, 
        response.status
      );
    case 401:
      throw new AuthenticationError(errorMessageFromServer, { response, errorData });
    case 403:
      throw new AuthorizationError(errorMessageFromServer, { response, errorData });
    case 404:
      throw new NotFoundError(context, `The requested ${context.toLowerCase()} was not found. ${errorMessageFromServer}`, { response, errorData });
    case 429: // Too Many Requests
        throw new ApiError(
            `TooManyRequests${context}`,
            `Too many requests ${serviceContext}. Please try again later. ${errorMessageFromServer}`,
            { response, errorData },
            response.status
        );
    default:
      // Includes 5xx server errors
      throw new ApiError(
        `ApiError${response.status}In${context}`,
        `An API error (status: ${response.status}) occurred ${serviceContext}. ${errorMessageFromServer}`,
        { response, errorData },
        response.status
      );
  }
}

/**
 * Fetches a specific recording by its ID from the backend.
 * @param id The ID of the recording to fetch.
 * @param token The authentication token (JWT) for the user.
 * @returns A promise that resolves to the Recording object.
 * @throws Will throw an error if the fetch fails or the recording is not found.
 */
export const getRecordingById = async (id: string, token: string): Promise<Recording> => {
  const context = "GetRecordingById";
  console.log(`Fetching recording with ID: ${id} from ${API_BASE_URL} (${context})`);

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}`, {
      method: 'GET',
      headers: headers 
    }); 

    return await handleFetchResponse<Recording>(response, context);

  } catch (error) {
    console.error(`Error in ${context}(${id}):`, error);
    if (error instanceof AppError) throw error;
    // For non-fetch related errors (e.g., network totally down before fetch is called)
    // or errors not caught by handleFetchResponse (should be rare)
    throw new NetworkError(error, `A network issue occurred while trying to fetch recording ${id}.`); 
  }
};

/**
 * Deletes a specific recording by its ID.
 * @param id The ID of the recording to delete.
 * @param token The authentication token (JWT) for the user.
 * @returns A promise that resolves when deletion is successful.
 * @throws Will throw an error if the deletion fails.
 */
export const deleteRecording = async (id: string, token: string): Promise<void> => {
  const context = "DeleteRecording";
  console.log(`Deleting recording with ID: ${id} from ${API_BASE_URL} (${context})`);

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}`, {
      method: 'DELETE',
      headers: headers,
    });

    // For DELETE, a 204 No Content is typical success.
    // handleFetchResponse expects JSON by default for 200, so we handle 204 separately here for clarity,
    // or adjust handleFetchResponse if 204 is common for other methods too.
    if (response.status === 204) {
      return; // Successfully deleted
    }
    
    // If not 204, let handleFetchResponse process it (it will throw an error for non-ok responses)
    // We pass a dummy success code that won't match if response.ok is false.
    await handleFetchResponse<any>(response, context, response.ok ? response.status : -1);
    
    // If handleFetchResponse didn't throw for an OK response that wasn't 204 (e.g. 200 on DELETE)
    if(response.ok) {
        console.warn(`Unexpected successful status code ${response.status} received after DELETE in ${context}.`);
        return; // Still consider it a success if it was OK.
    }

  } catch (error) {
    console.error(`Error in ${context}(${id}):`, error);
    if (error instanceof AppError) throw error;
    throw new NetworkError(error, `A network issue occurred while trying to delete recording ${id}.`);
  }
};

/**
 * Retry transcription for a failed recording
 * @param id The ID of the recording to retry
 * @param token The authentication token (JWT) for the user
 * @returns A promise that resolves to the updated Recording object
 * @throws Will throw an error if the retry fails
 */
export const retryTranscription = async (id: string, token: string): Promise<Recording> => {
  const context = "RetryTranscription";
  console.log(`Retrying transcription for recording with ID: ${id} (${context})`);

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}/retry-transcription`, {
      method: 'POST',
      headers: headers
    });

    // Assuming POST returns 200 OK with the updated/new recording data
    return await handleFetchResponse<Recording>(response, context, 200);

  } catch (error) {
    console.error(`Error in ${context}(${id}):`, error);
    if (error instanceof AppError) throw error;
    throw new NetworkError(error, `A network issue occurred while trying to retry transcription for recording ${id}.`);
  }
};

// Add other potential service functions here, e.g.:
// export const getAllRecordings = async (): Promise<Recording[]> => { ... };
// export const updateRecording = async (id: string, data: Partial<Recording>): Promise<Recording> => { ... };
// export const deleteRecording = async (id: string): Promise<void> => { ... }; 