#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ElevenLabs } from '@elevenlabs/elevenlabs-js';
import ffmpeg from 'fluent-ffmpeg';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const log = (step, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${step}] ${message}`);
};

const checkApiKeys = () => {
  const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nCreate a .env file based on .env.example');
    process.exit(1);
  }
};

const ensureFFmpeg = () => {
  log('SETUP', 'Checking ffmpeg installation...');
  try {
    execSync('which ffmpeg', { stdio: 'pipe' });
    log('SETUP', '✓ ffmpeg found in system PATH');
  } catch (error) {
    log('SETUP', '⚠️  ffmpeg not found in system PATH');
    log('SETUP', 'Install with: apt-get install ffmpeg (Linux) or brew install ffmpeg (macOS)');
    throw new Error('ffmpeg is required but not installed');
  }
};

const validateInput = async (inputFile) => {
  log('VALIDATE', `Checking input file: ${inputFile}`);
  try {
    const stats = await fs.stat(inputFile);
    if (!stats.isFile()) {
      throw new Error('Input is not a file');
    }
    log('VALIDATE', `✓ File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    return true;
  } catch (error) {
    log('VALIDATE', `❌ ${error.message}`);
    throw error;
  }
};

const transcribeVideo = async (inputFile) => {
  log('TRANSCRIBE', `Starting transcription of ${path.basename(inputFile)}...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const fileStream = await fs.readFile(inputFile);
    const blob = new Blob([fileStream], { type: 'video/mp4' });

    log('TRANSCRIBE', 'Sending to Whisper API...');
    const transcript = await openai.audio.transcriptions.create({
      file: blob,
      model: 'whisper-1',
    });

    log('TRANSCRIBE', `✓ Transcription complete (${transcript.text.length} characters)`);
    return transcript.text;
  } catch (error) {
    log('TRANSCRIBE', `❌ ${error.message}`);
    throw error;
  }
};

const generateScript = async (transcript) => {
  log('SCRIPT', 'Generating polished narrative script...');

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `You are a professional video content writer. Transform this video transcript into a polished narrative script with the following structure:

TRANSCRIPT:
"${transcript}"

Create a concise script (max 60 seconds when read aloud, roughly 150-180 words) with these sections:
1. HOOK - A compelling opening that grabs attention
2. PROBLEM - The core issue or challenge
3. SOLUTION - How it's solved
4. CTA - Clear call to action

Format the output as:
[HOOK]
[hook content here]

[PROBLEM]
[problem content here]

[SOLUTION]
[solution content here]

[CTA]
[cta content here]

Write in a natural, conversational tone suitable for voiceover narration.`;

  try {
    log('SCRIPT', 'Sending to Claude API...');
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const script = message.content[0].type === 'text' ? message.content[0].text : '';
    log('SCRIPT', `✓ Script generated (${script.length} characters)`);
    return script;
  } catch (error) {
    log('SCRIPT', `❌ ${error.message}`);
    throw error;
  }
};

const generateVoiceover = async (script, outputPath) => {
  log('VOICEOVER', 'Generating AI voiceover...');

  const client = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  try {
    log('VOICEOVER', 'Sending script to ElevenLabs...');
    const audio = await client.textToSpeech.convert({
      voice_id: process.env.ELEVENLABS_VOICE_ID,
      text: script,
      model_id: 'eleven_monolingual_v1',
    });

    log('VOICEOVER', `Saving audio to ${path.basename(outputPath)}...`);
    const buffer = Buffer.from(audio);
    await fs.writeFile(outputPath, buffer);
    log('VOICEOVER', `✓ Voiceover generated (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (error) {
    log('VOICEOVER', `❌ ${error.message}`);
    throw error;
  }
};

const mergeVideoAndAudio = (videoFile, audioFile, outputFile) => {
  return new Promise((resolve, reject) => {
    log('MERGE', 'Merging video and audio...');

    ffmpeg(videoFile)
      .input(audioFile)
      .audioCodec('aac')
      .videoCodec('copy')
      .outputOptions('-map', '0:v:0', '-map', '1:a:0')
      .on('start', (cmd) => {
        log('MERGE', 'FFmpeg processing started');
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r[MERGE] Progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(''); // newline after progress
        log('MERGE', `✓ Video merged successfully`);
        resolve();
      })
      .on('error', (err) => {
        log('MERGE', `❌ ${err.message}`);
        reject(err);
      })
      .save(outputFile);
  });
};

const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node glint.js <input.mp4>');
    console.log('\nExample: node glint.js my_video.mp4');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = 'output_glint.mp4';
  const tempDir = path.join(__dirname, '.glint-temp');
  const transcriptFile = path.join(tempDir, 'transcript.txt');
  const scriptFile = path.join(tempDir, 'script.txt');
  const voiceoverFile = path.join(tempDir, 'voiceover.mp3');
  const muteVideoFile = path.join(tempDir, 'video_muted.mp4');

  try {
    console.log('\n🎬 Glint - AI-Powered Video Polish Tool');
    console.log('=' .repeat(50));

    checkApiKeys();
    ensureFFmpeg();
    await validateInput(inputFile);

    await fs.mkdir(tempDir, { recursive: true });
    log('SETUP', `Created temp directory: ${tempDir}`);

    const transcript = await transcribeVideo(inputFile);
    await fs.writeFile(transcriptFile, transcript);

    const script = await generateScript(transcript);
    await fs.writeFile(scriptFile, script);
    log('SCRIPT', `Script saved to ${path.basename(scriptFile)}`);

    await generateVoiceover(script, voiceoverFile);

    await mergeVideoAndAudio(inputFile, voiceoverFile, outputFile);

    const outputStats = await fs.stat(outputFile);
    log('COMPLETE', `✓ Output saved: ${outputFile}`);
    log('COMPLETE', `✓ File size: ${(outputStats.size / (1024 * 1024)).toFixed(2)} MB`);

    log('CLEANUP', 'Cleaning up temporary files...');
    await fs.rm(tempDir, { recursive: true, force: true });
    log('CLEANUP', '✓ Cleanup complete');

    console.log('\n' + '='.repeat(50));
    console.log('✨ Video polishing complete!');
    console.log(`📁 Output: ${path.resolve(outputFile)}`);
    console.log('');

  } catch (error) {
    log('ERROR', `Fatal error: ${error.message}`);
    console.error('\nFull error:', error);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      // ignore cleanup errors
    }
    process.exit(1);
  }
};

main();
