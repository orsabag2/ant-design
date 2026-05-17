#!/usr/bin/env node

import dotenv from 'dotenv';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ElevenLabs } from '@elevenlabs/elevenlabs-js';

dotenv.config();

const log = (step, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${step}] ${message}`);
};

const testOpenAI = async () => {
  log('TEST', 'Testing OpenAI API...');
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const models = await openai.models.list();
    const hasWhisper = models.data.some(m => m.id.includes('whisper'));
    log('OPENAI', `✓ Connected (found ${models.data.length} models, Whisper: ${hasWhisper})`);
    return true;
  } catch (error) {
    log('OPENAI', `❌ ${error.message}`);
    return false;
  }
};

const testAnthropic = async () => {
  log('TEST', 'Testing Anthropic API...');
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello from Claude!" in 10 words or less.',
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : 'No response';
    log('ANTHROPIC', `✓ Connected - Response: "${response.substring(0, 50)}..."`);
    return true;
  } catch (error) {
    log('ANTHROPIC', `❌ ${error.message}`);
    return false;
  }
};

const testElevenLabs = async () => {
  log('TEST', 'Testing ElevenLabs API...');
  try {
    const client = new ElevenLabs({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    const audio = await client.textToSpeech.convert({
      voice_id: process.env.ELEVENLABS_VOICE_ID,
      text: 'Test audio generation',
      model_id: 'eleven_monolingual_v1',
    });

    log('ELEVENLABS', `✓ Connected - Generated audio (${audio.length} bytes)`);
    return true;
  } catch (error) {
    log('ELEVENLABS', `❌ ${error.message}`);
    return false;
  }
};

const main = async () => {
  console.log('\n🧪 Glint Pipeline Test Suite');
  console.log('='.repeat(50));
  console.log('Testing API connections...\n');

  const checkApiKeys = () => {
    const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\nCreate a .env file based on .env.example');
      return false;
    }
    return true;
  };

  if (!checkApiKeys()) {
    process.exit(1);
  }

  const results = {
    openai: await testOpenAI(),
    anthropic: await testAnthropic(),
    elevenlabs: await testElevenLabs(),
  };

  console.log('\n' + '='.repeat(50));
  console.log('Test Results:');
  console.log(`  OpenAI:     ${results.openai ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Anthropic:  ${results.anthropic ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  ElevenLabs: ${results.elevenlabs ? '✓ PASS' : '✗ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✨ All tests passed!' : '❌ Some tests failed'));
  console.log('');

  process.exit(allPassed ? 0 : 1);
};

main();
