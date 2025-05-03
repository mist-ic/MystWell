import secrets
import logging
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

# Import the loaded API key from the config module
from .config import TRANSCRIPTION_API_KEY

logger = logging.getLogger(__name__)

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def validate_api_key(api_key_header: str | None = Security(API_KEY_HEADER)):
    """FastAPI dependency to validate the X-API-Key header."""
    if not api_key_header:
        logger.warning("API key validation failed: Missing X-API-Key header.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key in X-API-Key header",
        )

    # Use secrets.compare_digest for timing-attack resistance
    if not secrets.compare_digest(api_key_header, TRANSCRIPTION_API_KEY):
        logger.warning("API key validation failed: Invalid API Key provided.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    # If validation passes, return True or the key itself, or nothing (just don't raise exception)
    # logger.debug("API key validation successful.") # Optional: Log success if needed
    return True # Or simply don't return anything 