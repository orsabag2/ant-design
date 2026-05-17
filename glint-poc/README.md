# Glint - AI-Powered Video Polish Tool (POC)

A proof-of-concept video processing pipeline that uses AI to generate polished narrative voiceovers for raw video content.

## Features

- 🎥 **Video Transcription**: Uses OpenAI Whisper API to transcribe video audio
- 🤖 **AI Script Generation**: Claude Sonnet generates polished narrative scripts with hook, problem, solution, and CTA
- 🎤 **AI Voiceover**: ElevenLabs generates natural-sounding voiceover from the script
- 🎬 **Video Merging**: FFmpeg combines muted video with new voiceover
- ⚡ **Automatic Setup**: Installs FFmpeg automatically if not found

## Pipeline Architecture

```
Input Video
    ↓
[1] Transcribe (Whisper API)
    ↓
[2] Generate Script (Claude API)
    ↓
[3] Generate Voiceover (ElevenLabs API)
    ↓
[4] Merge Video + Audio (FFmpeg)
    ↓
Output MP4 (output_glint.mp4)
```

## Prerequisites

- **Node.js 18+**
- **FFmpeg** (will be auto-installed)
- **API Keys**:
  - Anthropic API key (for Claude)
  - OpenAI API key (for Whisper)
  - ElevenLabs API key (for voice generation)

## Installation

```bash
cd glint-poc
npm install
```

## Setup

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

You can get a voice ID from [ElevenLabs Voice Library](https://elevenlabs.io/voice-library).

## Usage

### Run Full Pipeline

```bash
node glint.js input.mp4
```

Output will be saved as `output_glint.mp4`.

### Test API Connections

Before processing a full video, test that all APIs are properly configured:

```bash
npm test
```

This validates:
- OpenAI API (Whisper)
- Anthropic API (Claude)
- ElevenLabs API

## Workflow Example

```bash
# Test API connections
npm test

# Process a video
node glint.js my_raw_video.mp4

# Output ready!
# Check: output_glint.mp4
```

## Configuration

### Claude Model
Currently uses `claude-sonnet-4-20250514`. Can be changed in `glint.js`.

### Script Timing
- **Max Duration**: 60 seconds (roughly 150-180 words)
- **Adjustable**: Modify the prompt in `generateScript()` function

### Voice Settings
- **Model**: `eleven_monolingual_v1` (change in `generateVoiceover()`)
- **Voice ID**: Configurable via `ELEVENLABS_VOICE_ID`

## Temporary Files

During processing, temporary files are stored in `.glint-temp/`:
- `transcript.txt` - Raw transcription from Whisper
- `script.txt` - Polished script from Claude
- `voiceover.mp3` - Generated audio from ElevenLabs

These are automatically cleaned up after successful processing.

## Error Handling

- Missing API keys: Clear error messages with required variables
- Invalid input file: Validated before processing
- API failures: Detailed error logging for debugging
- Graceful cleanup: Temporary files removed on failure

## Logging

Each step is timestamped and logged:
```
[2025-05-17T10:30:45.123Z] [TRANSCRIBE] Sending to Whisper API...
[2025-05-17T10:31:02.456Z] [TRANSCRIBE] ✓ Transcription complete
```

## Cost Considerations

- **Whisper API**: ~$0.006 per minute of audio
- **Claude API**: Varies by tokens (~$3-15 per 1M tokens)
- **ElevenLabs**: ~$0.30 per 1K characters

## Troubleshooting

### "FFmpeg not found"
```bash
npm install ffmpeg-installer
```

### "Invalid API key"
Check your `.env` file has correct values and keys haven't expired.

### "File not found"
Ensure the video file path is correct and readable.

### "Transcription timeout"
For very long videos, Whisper API may timeout. Consider splitting into chunks.

## Future Improvements

- [ ] Batch processing multiple videos
- [ ] Custom script templates
- [ ] Video splitting for long files
- [ ] Progress bar UI
- [ ] Output quality presets
- [ ] Support for multiple languages
- [ ] Subtitle generation

## Architecture Notes

- **Modular Design**: Each pipeline step is a separate async function
- **Error Recovery**: Comprehensive error handling with cleanup
- **Extensible**: Easy to add new steps or change providers
- **Stateless**: Each run is independent, no persistent state

## License

MIT
