# Plan: Python Transcription Microservice (PySpee)

This document outlines the plan for creating a dedicated Python microservice using FastAPI to handle audio transcription via Google Cloud Speech-to-Text V2, specifically addressing the need to process M4A audio files from Android recordings.

## 1. Goal

Create a standalone, secure Python backend service hosted on Azure that:
- Accepts M4A audio files and a `profileId`.
- Transcribes the audio using Google Cloud Speech-to-Text V2 API, explicitly handling the M4A/AAC format.
- Returns the transcription result (or error) to the calling service (the existing NestJS backend).

## 2. Service Architecture

- **Framework:** Python 3.x with FastAPI & Uvicorn.
- **Hosting:** Azure App Service (initially).
- **Authentication (Internal):** API Key validation (passed via HTTP header).
- **Transcription Provider:** Google Cloud Speech-to-Text V2.

## 3. Project Setup (`PySpee/`)

- **Directory Structure:**
  ```
  PySpee/
  ├── .venv/              # Virtual environment
  ├── .env                # Environment variables
  ├── .gitignore
  ├── main.py             # FastAPI application entry point
  ├── requirements.txt    # Python dependencies
  ├── services/
  │   └── transcription.py # Logic for interacting with Google Speech API
  └── utils/
      └── security.py       # API key validation logic
      └── config.py         # Configuration loading
  ```
- **Dependencies (`requirements.txt`):**
  ```
  fastapi
  uvicorn[standard]         # Includes standard server dependencies like websockets if needed later
  google-cloud-speech     # Google Cloud Speech client library (ensure it's recent enough for V2 M4A_AAC)
  python-dotenv           # For loading .env files
  python-multipart        # Required by FastAPI for form data (file uploads)
  requests                # Good utility, though FastAPI has HTTPX built-in
  # Optional: ffmpeg-python (only if direct M4A_AAC fails unexpectedly)
  ```

## 4. API Endpoint (`main.py`)

- **Path:** `POST /transcribe`
- **Request:**
    - **Method:** POST
    - **Content-Type:** `multipart/form-data`
    - **Headers:**
        - `X-API-Key`: Contains the shared secret API key for authentication.
    - **Form Data:**
        - `audio_file`: The M4A audio file (`fastapi.UploadFile`).
        - `profile_id`: The profile ID string associated with the recording (`str`).
- **Response (Success):**
    - **Status Code:** `200 OK`
    - **Content-Type:** `application/json`
    - **Body:**
      ```json
      {
        "transcript": "The transcribed text..."
      }
      ```
- **Response (Error):**
    - **Status Code:** `400 Bad Request` (e.g., missing file/profileId), `401 Unauthorized` (invalid/missing API key), `422 Unprocessable Entity` (e.g., invalid file type if checked), `500 Internal Server Error` (Google API error, processing error).
    - **Content-Type:** `application/json`
    - **Body:**
      ```json
      {
        "detail": "Specific error message..."
      }
      ```

## 5. Transcription Logic (`services/transcription.py`)

1.  **Receive Data:** Function accepts `audio_file: UploadFile` and `profile_id: str`.
2.  **Read Audio:** Read the audio file content into bytes: `audio_content = await audio_file.read()`.
3.  **Initialize Client:** Create `speech_v2.SpeechClient()`. Authentication should use Application Default Credentials (ADC) when deployed on Azure (via Managed Identity or Service Account) or `GOOGLE_APPLICATION_CREDENTIALS` env var locally.
4.  **Get Recognizer:** Fetch the `GOOGLE_SPEECH_RECOGNIZER_NAME` from environment variables (same one used by NestJS).
5.  **Configure Request:**
    - Create `speech_v2.RecognitionConfig`.
        - Set `auto_decoding_config={}` (or omit if it defaults to disabled). **Do NOT rely on auto-detection for M4A.**
        - Set `language_codes=["en-US"]` (or make configurable if needed).
        - Set `model` (optional, could use default or specify e.g., `chirp`).
        - **Crucially:** Define `explicit_decoding_config` using `RecognitionConfig.ExplicitDecodingConfig`:
            - Set `encoding=speech_v2.RecognitionConfig.AudioEncoding.M4A_AAC`. Verify this exact enum value exists in the installed `google-cloud-speech` version.
            - Potentially set `sample_rate_hertz` and `audio_channel_count` if known and required for M4A_AAC, although the container *should* ideally provide this. Test without first.
    - Create `speech_v2.RecognizeRequest`.
        - Assign the `recognizer` name.
        - Assign the `config`.
        - Assign the audio content: `content=audio_content`.
6.  **Call Google API:**
    - `response = client.recognize(request=request)`
7.  **Process Response:**
    - Check for errors in the response.
    - If results exist: `transcript = " ".join(result.alternatives[0].transcript for result in response.results)`
    - Return the transcript string.
8.  **Error Handling:** Catch exceptions from the Google client, file reading, etc. Log errors and raise appropriate HTTP exceptions (e.g., `HTTPException` from FastAPI) to be handled by the main endpoint.

## 6. Security (`utils/security.py`)

- Create a FastAPI dependency function (`validate_api_key`).
- Reads `X-API-Key` header from the request.
- Reads the expected `TRANSCRIPTION_API_KEY` from environment variables (`utils/config.py`).
- Compares the keys using a timing-safe comparison.
- Raises `HTTPException(status_code=401, detail="Invalid or missing API key")` if validation fails.
- The `/transcribe` endpoint will use `Depends(validate_api_key)`.

## 7. Configuration (`.env` & `utils/config.py`)

- **`.env`:**
  ```
  GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json # For local dev
  GOOGLE_SPEECH_RECOGNIZER_NAME=projects/your-gcp-project/locations/global/recognizers/your-recognizer # Needs to be set
  TRANSCRIPTION_API_KEY=your_strong_secret_key # Shared secret with NestJS
  ```
- **`utils/config.py`:** Use `pydantic-settings` or `python-dotenv` to load these into a settings object or directly access via `os.getenv`.

## 8. Azure Deployment

- Create Azure App Service instance (Python runtime).
- Configure Environment Variables in App Service settings (for `GOOGLE_SPEECH_RECOGNIZER_NAME`, `TRANSCRIPTION_API_KEY`).
- Configure Authentication: Use Managed Identity for the App Service; grant it necessary IAM roles (e.g., "Cloud Speech Service Agent" or similar) on the GCP project so ADC works without a key file.
- Set up deployment (GitHub Actions, Azure DevOps, VS Code, etc.).
- Startup command: `uvicorn main:app --host 0.0.0.0 --port 8000` (or port provided by App Service).

## 9. NestJS Integration (Recap)

- Add `TRANSCRIPTION_SERVICE_URL` and `TRANSCRIPTION_API_KEY` to NestJS `.env`.
- Modify `SpeechToTextService` in NestJS to use `HttpService`:
    - Remove Google SDK calls.
    - POST `multipart/form-data` request to Python service (`/transcribe`).
    - Include `audioBytes` as `audio_file` part.
    - Include `profileId` as `profile_id` part.
    - Add `X-API-Key` header.
    - Handle JSON response (extract `transcript`) or error.
- Ensure `form-data` package or similar is used in NestJS to correctly format the multipart request with a Buffer.


This detailed plan covers the key aspects. We can now proceed with the implementation steps in Python. 