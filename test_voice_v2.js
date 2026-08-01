import assert from 'assert';
import { VOICE_PROVIDERS } from './config/voiceProviders.js';
import { selectVoiceProvider } from './services/voiceRouter.js';

console.log("==========================================================");
console.log("  VOICE AGENT v2 — AUTOMATED TEST SUITE");
console.log("==========================================================\n");

let passed = 0;
let failed = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

console.log("--- 1. Testing config/voiceProviders.js ---\n");

runTest("VOICE_PROVIDERS object is exported and defined", () => {
  assert.ok(VOICE_PROVIDERS, "VOICE_PROVIDERS is undefined");
  assert.strictEqual(typeof VOICE_PROVIDERS, 'object');
});

runTest("All required providers (elevenlabs, google, openai, tacotron) are present", () => {
  const keys = Object.keys(VOICE_PROVIDERS);
  assert.ok(keys.includes('elevenlabs'), "Missing elevenlabs provider");
  assert.ok(keys.includes('google'), "Missing google provider");
  assert.ok(keys.includes('openai'), "Missing openai provider");
  assert.ok(keys.includes('tacotron'), "Missing tacotron provider");
});

runTest("ElevenLabs provider structure, languages, useCases, and voice settings are valid", () => {
  const el = VOICE_PROVIDERS.elevenlabs;
  assert.strictEqual(el.name, "ElevenLabs Multilingual v2");
  assert.strictEqual(el.model, "eleven_multilingual_v2");
  assert.ok(Array.isArray(el.languages) && el.languages.includes("en"), "languages should include 'en'");
  assert.ok(Array.isArray(el.useCases) && el.useCases.includes("conversation"), "useCases should include 'conversation'");
  assert.strictEqual(el.primaryProvider, true);
  assert.strictEqual(el.voiceSettings.stability, 0.5);
});

runTest("Google Neural provider structure, languages, and useCases are valid", () => {
  const gg = VOICE_PROVIDERS.google;
  assert.strictEqual(gg.name, "Google Neural Multilingual & Indic TTS");
  assert.strictEqual(gg.engine, "neural");
  assert.ok(Array.isArray(gg.languages) && gg.languages.includes("pa"), "languages should include 'pa'");
  assert.ok(Array.isArray(gg.useCases) && gg.useCases.includes("fallback"), "useCases should include 'fallback'");
  assert.strictEqual(gg.fallbackProvider, true);
});

console.log("\n--- 2. Testing services/voiceRouter.js ---\n");

runTest("selectVoiceProvider is a function", () => {
  assert.strictEqual(typeof selectVoiceProvider, 'function');
});

runTest("Rule 1: Customer support use case -> returns openai primary, elevenlabs fallback", () => {
  const result = selectVoiceProvider({ language: 'en-US', useCase: 'customer_support' });
  assert.deepStrictEqual(result, {
    language: 'en',
    provider: 'openai',
    fallbackProvider: 'elevenlabs',
    reason: 'Optimal clarity, reliability, and speed for customer support interactions'
  });
});

runTest("Rule 2: Storytelling use case -> returns elevenlabs primary, openai fallback", () => {
  const result = selectVoiceProvider({ language: 'en-US', useCase: 'storytelling' });
  assert.deepStrictEqual(result, {
    language: 'en',
    provider: 'elevenlabs',
    fallbackProvider: 'openai',
    reason: 'Rich emotional expressiveness and character realism for storytelling'
  });
});

runTest("Rule 3: Hindi ('hi-IN') -> returns elevenlabs primary, google fallback", () => {
  const result = selectVoiceProvider({ language: 'hi-IN' });
  assert.deepStrictEqual(result, {
    language: 'hi',
    provider: 'elevenlabs',
    fallbackProvider: 'google',
    reason: 'ElevenLabs Devanagari/Gurmukhi phonetic realism with Google Neural Indic fallback'
  });
});

runTest("Rule 4: Punjabi ('pa-IN') -> returns elevenlabs primary, google fallback", () => {
  const result = selectVoiceProvider({ language: 'pa-IN' });
  assert.deepStrictEqual(result, {
    language: 'pa',
    provider: 'elevenlabs',
    fallbackProvider: 'google',
    reason: 'ElevenLabs Devanagari/Gurmukhi phonetic realism with Google Neural Indic fallback'
  });
});

runTest("Rule 5: Arabic ('ar-SA') -> returns elevenlabs primary, google fallback", () => {
  const result = selectVoiceProvider({ language: 'ar-SA' });
  assert.deepStrictEqual(result, {
    language: 'ar',
    provider: 'elevenlabs',
    fallbackProvider: 'google',
    reason: 'ElevenLabs multilingual realism with Google Arabic dialect fallback'
  });
});

runTest("Rule 6: Spanish ('es-ES') -> returns elevenlabs primary, openai fallback", () => {
  const result = selectVoiceProvider({ language: 'es-ES' });
  assert.deepStrictEqual(result, {
    language: 'es',
    provider: 'elevenlabs',
    fallbackProvider: 'openai',
    reason: 'ElevenLabs Multilingual v2 optimal for conversational realism'
  });
});

runTest("Rule 7: Unknown language ('ko-KR') -> returns elevenlabs primary, google fallback", () => {
  const result = selectVoiceProvider({ language: 'ko-KR' });
  assert.deepStrictEqual(result, {
    language: 'ko',
    provider: 'elevenlabs',
    fallbackProvider: 'google',
    reason: 'Default ElevenLabs multilingual TTS provider for unsupported/general locales'
  });
});

runTest("Rule 8: String language call ('en-US') -> returns elevenlabs primary, openai fallback", () => {
  const result = selectVoiceProvider('en-US');
  assert.deepStrictEqual(result, {
    language: 'en',
    provider: 'elevenlabs',
    fallbackProvider: 'openai',
    reason: 'ElevenLabs Multilingual v2 optimal for conversational realism'
  });
});

console.log("\n==========================================================");
console.log(`  TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log("==========================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
