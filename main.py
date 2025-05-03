import logging
from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status

# Import the transcription service function
from services.transcription import transcribe_audio_v2
# Import the API key validation dependency
from utils.security import validate_api_key

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PySpee Transcription Service",
    description="A microservice to transcribe M4A audio files using Google Cloud Speech-to-Text V2.",
    version="0.1.0",
)

# --- API Endpoints --- 

@app.get("/health", tags=["Health"])
async def health_check():
    """Simple health check endpoint."""
    # In the future, could check Google client initialization status
    return {"status": "ok"}

@app.post(
    "/transcribe", 
    tags=["Transcription"],
    dependencies=[Depends(validate_api_key)] # Protect this endpoint with API key validation
)
async def process_transcription(
    profile_id: str = Form(...), # Get profile_id from form data
    audio_file: UploadFile = File(...) # Get audio file from form data
):
    """Receives an M4A audio file and profile ID, transcribes it, and returns the text."""
    
    logger.info(f"Received transcription request for profile_id: {profile_id}, filename: {audio_file.filename}")

    # Basic check for file content type (optional but recommended)
    # M4A files usually have 'audio/mp4' or 'audio/x-m4a' or similar
    if audio_file.content_type and not audio_file.content_type.startswith("audio/"):
         logger.warning(f"Received file with unexpected content type: {audio_file.content_type}")
        # Depending on strictness, you might reject here
        # raise HTTPException(
        #     status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        #     detail=f"Unsupported file type: {audio_file.content_type}. Expected audio.",
        # )

    try:
        # Read audio content
        audio_content = await audio_file.read()
        if not audio_content:
             logger.error("Received empty audio file.")
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")

        # Call the transcription service
        transcript = transcribe_audio_v2(audio_content=audio_content, profile_id=profile_id)
        
        logger.info(f"Successfully generated transcript for profile_id: {profile_id}")
        return {"transcript": transcript}

    except HTTPException as http_exc: # Re-raise HTTP exceptions from the service layer
        raise http_exc 
    except Exception as e:
        # Catch-all for unexpected errors during file reading or service call prep
        logger.exception(f"Unexpected error processing transcription for profile_id {profile_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )
    finally:
        # Ensure the uploaded file is closed
        await audio_file.close()

# --- Uvicorn entry point (for running with `python main.py`) --- 
# Note: For production, it's better to run using `uvicorn main:app --host 0.0.0.0 --port 8000` directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server directly...")
    # Host 0.0.0.0 makes it accessible externally (within network constraints)
    # Port 8000 is a common default for web services
    # reload=True is useful for development, disable in production
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 