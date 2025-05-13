#!/bin/bash

echo "Starting FFmpeg installation for FinalMist..."

# Check if we're in a Linux environment
if [ "$(uname)" == "Linux" ]; then
    # Update package lists
    apt-get update

    # Install FFmpeg
    apt-get install -y ffmpeg

    # Verify installation
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    FFPROBE_VERSION=$(ffprobe -version | head -n 1)
    
    echo "FFmpeg installation completed."
    echo "FFmpeg version: $FFMPEG_VERSION"
    echo "FFprobe version: $FFPROBE_VERSION"
    
    # Write the paths to a file that can be sourced
    echo "FFMPEG_PATH=$(which ffmpeg)" > /home/site/wwwroot/.ffmpeg-paths
    echo "FFPROBE_PATH=$(which ffprobe)" >> /home/site/wwwroot/.ffmpeg-paths
    
    # Set environment variables
    export FFMPEG_PATH=$(which ffmpeg)
    export FFPROBE_PATH=$(which ffprobe)
    
    echo "FFmpeg path: $FFMPEG_PATH"
    echo "FFprobe path: $FFPROBE_PATH"
else
    echo "Not in a Linux environment. FFmpeg installation skipped."
    echo "Please manually install FFmpeg and configure the paths in your environment variables."
fi

echo "Post-deployment script completed." 