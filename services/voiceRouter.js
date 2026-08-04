/**
 * Voice Router Service (services/voiceRouter.js)
 *
 * Intelligent TTS provider selection and fallback routing based on language,
 * conversational useCase, emotional styling, and regional accent rules.
 */

const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'ar', 'es', 'fr', 'de', 'zh', 'ja'];

/**
 * Normalizes a locale/language string to its primary 2-letter ISO 639-1 language code.
 *
 * Examples:
 *   "en-US" -> "en"
 *   "hi-IN" -> "hi"
 *   "pa-IN" -> "pa"
 *   "ar-SA" -> "ar"
 *
 * @param {string} language
 * @returns {string}
 */
function normalizeLanguage(language = 'en-US') {
  if (!language || typeof language !== 'string') {
    return 'en';
  }
  return language.trim().split(/[-_]/)[0].toLowerCase();
}

/**
 * Selects the optimal TTS provider and fallback provider based on language code,
 * use case, emotion, and speaking style.
 *
 * Supported languages: en, hi, pa, ar, es, fr, de, zh, ja
 *
 * Provider Selection Rules:
 *   - Fallback Style/UseCase: Prefer Google Neural
 *   - Customer Support: Prefer OpenAI TTS
 *   - Storytelling: Prefer ElevenLabs Multilingual v2
 *   - Indic Languages (hi, pa): ElevenLabs first, Google Neural as fallback
 *   - Arabic (ar): ElevenLabs first, Google Arabic as fallback
 *   - General Conversation (en, es, fr, de, zh, ja): Prefer ElevenLabs Multilingual v2
 *   - Unknown languages: ElevenLabs with Google fallback
 *
 * @param {object|string} params - Configuration object or language string
 * @param {string} [params.language="en-US"] - Language code
 * @param {string} [params.emotion] - Emotion style (e.g. "warm", "empathetic", "assertive")
 * @param {string} [params.style] - Delivery style (e.g. "storytelling", "formal", "casual", "fallback")
 * @param {string} [params.useCase] - Use case scenario ("customer_support", "storytelling", "general", "fallback")
 * @returns {{ language: string, provider: string, fallbackProvider: string, reason: string }}
 */
export function selectVoiceProvider(input = {}) {
  let language;
  if (typeof input === 'string') {
    language = input;
  } else if (input && typeof input === 'object') {
    language = input.language;
  }
  const normalizedLang = normalizeLanguage(language || 'en-US');
  console.log("[VOICE DEBUG] VOICE ROUTER LANGUAGE:", normalizedLang);
  const decision = _selectVoiceProviderInternal(input, normalizedLang);
  console.log("[VOICE DEBUG] PROVIDER SELECTED:", decision.provider);
  console.log("[VOICE DEBUG] PROVIDER:", decision.provider);
  return decision;
}

function _selectVoiceProviderInternal(input = {}, normalizedLang) {
  let language, emotion, style, useCase;

  if (typeof input === 'string') {
    language = input;
  } else if (input && typeof input === 'object') {
    language = input.language;
    emotion = input.emotion;
    style = input.style;
    useCase = input.useCase;
  }

  const isIndic = (normalizedLang === 'hi' || normalizedLang === 'pa');
  const isArabic = (normalizedLang === 'ar');
  const isKnown = SUPPORTED_LANGUAGES.includes(normalizedLang);

  // Rule 0: Explicit fallback style or useCase requests Google Neural
  if (style === 'fallback' || useCase === 'fallback') {
    return {
      language: normalizedLang,
      provider: 'google',
      fallbackProvider: 'elevenlabs',
      reason: 'Explicit fallback style/useCase requested'
    };
  }

  // Rule 1: Customer Support use case prefers OpenAI TTS
  if (useCase === 'customer_support' || useCase === 'support') {
    return {
      language: normalizedLang,
      provider: 'openai',
      fallbackProvider: (isIndic || isArabic) ? 'google' : 'elevenlabs',
      reason: 'Optimal clarity, reliability, and speed for customer support interactions'
    };
  }

  // Rule 2: Storytelling use case prefers ElevenLabs Multilingual v2
  if (useCase === 'storytelling' || style === 'storytelling') {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: (isIndic || isArabic) ? 'google' : 'openai',
      reason: 'Rich emotional expressiveness and character realism for storytelling'
    };
  }

  // Rule 3: Indic languages (Hindi, Punjabi) -> try ElevenLabs first, Google Neural fallback
  if (isIndic) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'google',
      reason: 'ElevenLabs Devanagari/Gurmukhi phonetic realism with Google Neural Indic fallback'
    };
  }

  // Rule 4: Arabic (ar) -> try ElevenLabs first, Google Arabic fallback
  if (isArabic) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'google',
      reason: 'ElevenLabs multilingual realism with Google Arabic dialect fallback'
    };
  }

  // Rule 5: Supported general conversational languages (en, es, fr, de, zh, ja)
  if (isKnown) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'openai',
      reason: 'ElevenLabs Multilingual v2 optimal for conversational realism'
    };
  }

  // Rule 6: Unknown languages default to ElevenLabs with Google fallback
  return {
    language: normalizedLang,
    provider: 'elevenlabs',
    fallbackProvider: 'google',
    reason: 'Default ElevenLabs multilingual TTS provider for unsupported/general locales'
  };
}

export default {
  selectVoiceProvider
};
