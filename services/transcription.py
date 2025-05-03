import logging
from fastapi import UploadFile, HTTPException, status
from google.cloud import speech_v2
from google.api_core.exceptions import GoogleAPICallError, NotFound

# Import config variables
from utils.config import GOOGLE_SPEECH_RECOGNIZER_NAME

logger = logging.getLogger(__name__)

# Initialize the Speech client (singleton pattern might be better for efficiency)
# but creating it per request is simpler for now.
# Consider initializing once in main.py and passing it via dependency injection if performance is critical.
try:
    speech_client = speech_v2.SpeechClient()
    logger.info("Google Speech Client initialized successfully.")
except Exception as e:
    logger.exception("Failed to initialize Google Speech Client! Check credentials/permissions.")
    # Allow the app to start, but transcription will fail.
    speech_client = None

def transcribe_audio_v2(
    audio_content: bytes,
    profile_id: str # Keep profile_id for potential future use or logging
) -> str:
    """Transcribes audio content using Google Cloud Speech-to-Text V2."""

    if not speech_client:
        logger.error("Speech client not available. Initialization likely failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription service is not properly configured (Speech Client)."
        )

    logger.info(f"Starting V2 transcription for profile {profile_id}. Audio size: {len(audio_content)} bytes.")

    # --- Configuration --- 
    # Explicitly configure for M4A/AAC
    # Verify M4A_AAC enum exists. If not, the google-cloud-speech library might be too old.
    try:
        encoding_config = speech_v2.RecognitionConfig.ExplicitDecodingConfig(
            encoding=speech_v2.RecognitionConfig.AudioEncoding.M4A_AAC,
            # Sample rate and channel count *might* be automatically detected from the container.
            # Add them here if transcription fails without them.
            # sample_rate_hertz=16000,  # Example
            # audio_channel_count=1, # Example
        )
    except AttributeError:
        logger.exception("Failed to find M4A_AAC encoding. Is google-cloud-speech library up to date (>=2.20.0)?")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transcription service configuration error (Audio Encoding)."
        )
        
    config = speech_v2.RecognitionConfig(
        explicit_decoding_config=encoding_config,
        language_codes=["en-US"],  # Assuming US English
        model="long", # Specify model if desired, e.g. "long", "medical_dictation", "chirp"
        # features=speech_v2.RecognitionFeatures(
        #     enable_automatic_punctuation=True,
        #     # Add other features as needed
        # ),
        # auto_decoding_config={} # Ensure this is NOT set when using explicit_decoding_config
    )

    request = speech_v2.RecognizeRequest(
        recognizer=GOOGLE_SPEECH_RECOGNIZER_NAME,
        config=config,
        content=audio_content,
    )

    # --- API Call --- 
    try:
        logger.debug(f"Sending transcription request to recognizer: {GOOGLE_SPEECH_RECOGNIZER_NAME}")
        response = speech_client.recognize(request=request)
        logger.debug("Received transcription response from Google API.")

    except NotFound as e:
        logger.error(f"Recognizer '{GOOGLE_SPEECH_RECOGNIZER_NAME}' not found. Please check the name and region.", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription recognizer configuration error: {e.message}"
        )
    except GoogleAPICallError as e:
        logger.error("Google API call failed during transcription.", exc_info=True)
        # You might want more specific error handling here based on e.code() or e.message
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed due to Google API error: {e.message}"
        )
    except Exception as e:
        logger.exception("An unexpected error occurred during the transcription API call.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during transcription."
        )

    # --- Process Response --- 
    if not response or not response.results:
        logger.warning("Transcription response received, but contained no results.")
        # Return empty string or perhaps raise an error? For now, empty string.
        return ""

    # Combine results
    transcript = " ".join(
        result.alternatives[0].transcript for result in response.results if result.alternatives
    ).strip()
    
    if not transcript:
        logger.warning("Transcription results were present, but contained no actual text.")
        return ""
        
    logger.info(f"Transcription successful for profile {profile_id}. Transcript length: {len(transcript)}")
    # logger.debug(f"Transcript snippet: {transcript[:100]}...") # Optional: Log snippet

    return transcript 