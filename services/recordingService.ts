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
const API_BASE_URL = 'REDACTED_API_URL'; // Hardcoded production URL

/**
 * Fetches a specific recording by its ID from the backend.
 * @param id The ID of the recording to fetch.
 * @param token The authentication token (JWT) for the user.
 * @returns A promise that resolves to the Recording object.
 * @throws Will throw an error if the fetch fails or the recording is not found.
 */
export const getRecordingById = async (id: string, token: string): Promise<Recording> => {
  console.log(`Fetching recording with ID: ${id} from ${API_BASE_URL}`);

  // --- Real API Call Implementation ---
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json' // Optional, but good practice
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}`, {
      method: 'GET',
      headers: headers 
    }); 

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}: ${response.statusText || 'Failed to fetch recording'}`;
      try {
          const errorData = await response.json();
          errorMessage = `Error ${response.status}: ${errorData.message || errorMessage}`;
      } catch (parseError) {
          // Ignore if response body is not JSON or empty
      }
      // Add a specific check for 401 to provide a clearer message if needed elsewhere
      if (response.status === 401) {
         throw new Error('Authorization failed. Token might be invalid or missing.');
      }
      throw new Error(errorMessage);
    }

    const data: Recording = await response.json();
    return data;
  } catch (error) {
    console.error(`Error in getRecordingById(${id}):`, error);
    if (error instanceof Error) {
        throw error; 
    } else {
        throw new Error('An unexpected error occurred during fetch.');
    }
  }
  // --- End Real API Call ---

  /* --- Removed Mock Data --- 
  // Simulate API delay
  // await new Promise(resolve => setTimeout(resolve, 500)); 
  
  // Simulate different scenarios based on ID for testing
  // ... mock data removed ...
  */
};

/**
 * Deletes a specific recording by its ID.
 * @param id The ID of the recording to delete.
 * @param token The authentication token (JWT) for the user.
 * @returns A promise that resolves when deletion is successful.
 * @throws Will throw an error if the deletion fails.
 */
export const deleteRecording = async (id: string, token: string): Promise<void> => {
  console.log(`Deleting recording with ID: ${id} from ${API_BASE_URL}`);

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}`, {
      method: 'DELETE',
      headers: headers,
    });

    if (response.status === 204) {
      // Successful deletion (No Content)
      return;
    }
    
    if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}: ${response.statusText || 'Failed to delete recording'}`;
        try {
            const errorData = await response.json();
            errorMessage = `Error ${response.status}: ${errorData.message || errorMessage}`;
        } catch (parseError) {
            // Ignore if response body is not JSON or empty
        }
        if (response.status === 401) {
            throw new Error('Authorization failed. Token might be invalid or missing.');
        }
        if (response.status === 403) {
            throw new Error('Forbidden. You do not have permission to delete this recording.');
        }
        if (response.status === 404) {
            throw new Error('Recording not found.');
        }
        throw new Error(errorMessage);
    }

    // Handle unexpected success statuses if needed (e.g., 200 OK)
    // Normally, DELETE should return 204 No Content on success.
    console.warn(`Unexpected successful status code ${response.status} received after DELETE.`);

  } catch (error) {
    console.error(`Error in deleteRecording(${id}):`, error);
    if (error instanceof Error) {
      throw error; 
    } else {
      throw new Error('An unexpected error occurred during deletion.');
    }
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
  console.log(`Retrying transcription for recording with ID: ${id}`);

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_BASE_URL}/recordings/${id}/retry-transcription`, {
      method: 'POST',
      headers: headers
    });

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}: ${response.statusText || 'Failed to retry transcription'}`;
      try {
        const errorData = await response.json();
        errorMessage = `Error ${response.status}: ${errorData.message || errorMessage}`;
      } catch (parseError) {
        // Ignore if response body is not JSON or empty
      }
      if (response.status === 401) {
        throw new Error('Authorization failed. Token might be invalid or missing.');
      }
      throw new Error(errorMessage);
    }

    const data: Recording = await response.json();
    return data;
  } catch (error) {
    console.error(`Error in retryTranscription(${id}):`, error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during transcription retry.');
    }
  }
};

// Add other potential service functions here, e.g.:
// export const getAllRecordings = async (): Promise<Recording[]> => { ... };
// export const updateRecording = async (id: string, data: Partial<Recording>): Promise<Recording> => { ... };
// export const deleteRecording = async (id: string): Promise<void> => { ... }; 