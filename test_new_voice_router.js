import assert from 'assert';
import { selectVoiceProvider } from './services/voiceRouter.js';

console.log("==========================================================");
console.log("  NEW VOICE ROUTER — DEDICATED AUTOMATED TESTS");
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

// 1. language: pa-IN, style: conversation -> Expected: provider: elevenlabs
runTest("Test 1: pa-IN + conversation style -> provider: elevenlabs", () => {
  const result = selectVoiceProvider({ language: 'pa-IN', style: 'conversation' });
  assert.strictEqual(result.provider, 'elevenlabs', `Expected provider 'elevenlabs', got '${result.provider}'`);
});

// 2. language: pa-IN, style: fallback -> Expected: provider: google
runTest("Test 2: pa-IN + fallback style -> provider: google", () => {
  const result = selectVoiceProvider({ language: 'pa-IN', style: 'fallback' });
  assert.strictEqual(result.provider, 'google', `Expected provider 'google', got '${result.provider}'`);
});

// 3. language: en-US, style: storytelling -> Expected: provider: elevenlabs
runTest("Test 3: en-US + storytelling style -> provider: elevenlabs", () => {
  const result = selectVoiceProvider({ language: 'en-US', style: 'storytelling' });
  assert.strictEqual(result.provider, 'elevenlabs', `Expected provider 'elevenlabs', got '${result.provider}'`);
});

// 4. language: ar-SA -> Expected: primary: elevenlabs, fallback: google
runTest("Test 4: ar-SA -> primary: elevenlabs, fallback: google", () => {
  const result = selectVoiceProvider({ language: 'ar-SA' });
  assert.strictEqual(result.provider, 'elevenlabs', `Expected primary provider 'elevenlabs', got '${result.provider}'`);
  assert.strictEqual(result.fallbackProvider, 'google', `Expected fallback provider 'google', got '${result.fallbackProvider}'`);
});

// 5. unknown language -> Expected: elevenlabs
runTest("Test 5: unknown language ('ko-KR') -> provider: elevenlabs", () => {
  const result = selectVoiceProvider({ language: 'ko-KR' });
  assert.strictEqual(result.provider, 'elevenlabs', `Expected provider 'elevenlabs', got '${result.provider}'`);
});

console.log("\n==========================================================");
console.log(`  TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log("==========================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
