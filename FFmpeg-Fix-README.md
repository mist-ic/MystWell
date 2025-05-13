# FFmpeg Integration Fix

## The Problem

The application was failing with the error `Cannot find ffprobe` when attempting to process audio recordings. This issue was occurring because:

1. The `AudioProcessorService` relies on FFmpeg for audio processing
2. FFmpeg was not installed or properly configured on the Azure Web App environment
3. There was no graceful error handling for this scenario

## Changes Made

### 1. Enhanced `AudioProcessorService` (audio-processor.service.ts)

- Added `OnModuleInit` interface to check for FFmpeg availability at startup
- Added configuration via environment variables (`FFMPEG_PATH` and `FFPROBE_PATH`)
- Implemented graceful error handling when FFmpeg is not available
- Added an `isFFmpegAvailable()` method to check availability before attempting operations

### 2. Updated `RecordingProcessor` (recording.processor.ts)

- Added early check for FFmpeg availability before attempting audio processing
- Improved error handling for audio processing failures
- Better error categorization (`processing_failed` for FFmpeg-related issues)

### 3. Added Deployment Scripts

- Created `.deployment` file to configure Azure deployment
- Added `.scripts/postdeployment.sh` to install FFmpeg during deployment
- Made the script cross-platform aware and able to detect installation success

### 4. Added Documentation

- Created comprehensive documentation in `docs/ffmpeg-configuration.md`
- Provided multiple solutions to fix the issue
- Added testing and verification instructions

## How to Verify

1. Make sure the changes are deployed to your Azure Web App
2. Check the application logs for:
   - FFmpeg availability messages at startup
   - Clear error messages if FFmpeg is still missing
3. Test audio processing functionality

## Next Steps

1. Monitor the application to ensure audio processing works correctly
2. If problems persist, consider the alternative solutions in the documentation
3. For high-volume audio processing, consider using a dedicated service or container

See the detailed configuration guide in `docs/ffmpeg-configuration.md` for more information. 