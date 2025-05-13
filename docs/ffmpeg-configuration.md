# FFmpeg Configuration Guide

## Background

The `AudioProcessorService` uses the [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) library which requires FFmpeg binaries to be installed on the server. FFmpeg is used for audio format detection and conversion.

## Current Error

The application is currently failing with the error:
```
Error: Cannot find ffprobe
```

This happens because FFmpeg is not installed or properly configured on the Azure Web App service.

## Solutions

### Option 1: Install FFmpeg on the Azure Web App

For an Azure Web App running on Linux, you can install FFmpeg using a startup script. Create a file named `.deployment` in the root of your project with:

```
[config]
SCM_POST_DEPLOYMENT_ACTIONS_PATH = .scripts
```

Then create a folder named `.scripts` and add a file named `postdeployment.sh`:

```bash
#!/bin/bash
echo "Installing FFmpeg..."
apt-get update
apt-get install -y ffmpeg
echo "FFmpeg installed successfully!"
```

Make sure the script is executable:
```bash
chmod +x .scripts/postdeployment.sh
```

### Option 2: Use Custom FFmpeg Paths

If you have FFmpeg installed in a custom location, you can configure the paths using environment variables:

1. Add the following environment variables to your Azure Web App configuration:
   - `FFMPEG_PATH`: Path to the ffmpeg binary
   - `FFPROBE_PATH`: Path to the ffprobe binary

2. The updated `AudioProcessorService` will automatically detect and use these custom paths.

### Option 3: Use FFmpeg.wasm (Client-side Processing)

For lightweight audio processing, consider using [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) which runs directly in the browser, eliminating the need for server-side FFmpeg.

## Error Handling

The application has been updated to handle FFmpeg unavailability gracefully:

1. The `AudioProcessorService` now checks if FFmpeg is available during initialization
2. If FFmpeg is not available, the service fails gracefully with clear error messages
3. The `RecordingProcessor` now reports specific errors related to audio processing

## Testing

To verify your FFmpeg installation:

1. SSH into your Azure Web App instance
2. Run `ffmpeg -version` to check the FFmpeg version
3. Run `ffprobe -version` to check the FFprobe version

Both commands should return version information if correctly installed.

## Additional Notes

- FFmpeg is a large library (~30-50MB) that may increase your deployment size
- Consider using a dedicated server or container for audio processing if you have high volume
- Check if your Azure Web App Service Plan supports custom binary installations 