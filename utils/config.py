import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

def get_env_variable(var_name: str, default: str | None = None) -> str:
    """Gets an environment variable or raises an error if not found and no default is provided."""
    value = os.getenv(var_name, default)
    if value is None:
        logger.error(f"Environment variable '{var_name}' not found and no default value provided.")
        raise EnvironmentError(f"Missing required environment variable: '{var_name}'")
    return value

# --- Load specific configuration values ---

# Attempt to load GOOGLE_APPLICATION_CREDENTIALS, but don't fail if not present
# (ADC might use other methods, especially on Azure)
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if GOOGLE_APPLICATION_CREDENTIALS:
    logger.info(f"Using GOOGLE_APPLICATION_CREDENTIALS from: {GOOGLE_APPLICATION_CREDENTIALS}")
else:
    logger.info("GOOGLE_APPLICATION_CREDENTIALS not set, relying on Application Default Credentials discovery.")

# These are critical and must be set
GOOGLE_SPEECH_RECOGNIZER_NAME = get_env_variable("GOOGLE_SPEECH_RECOGNIZER_NAME")
TRANSCRIPTION_API_KEY = get_env_variable("TRANSCRIPTION_API_KEY")


# You could also define a Pydantic settings model here for more robust validation
# from pydantic_settings import BaseSettings
# class Settings(BaseSettings):
#     google_application_credentials: str | None = None
#     google_speech_recognizer_name: str
#     transcription_api_key: str
#     class Config:
#         env_file = '.env'
# settings = Settings() 