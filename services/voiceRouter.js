/**
 * Voice Router Service (services/voiceRouter.js)
 *
 * Intelligent TTS provider selection and fallback routing based on language,
 * conversational useCase, emotional styling, and regional accent rules.
 */
import INDIAN_VOICE_MAP from './indianVoiceMap.js';

const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'bn', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'or', 'ur', 'ar', 'es', 'fr', 'de', 'zh', 'ja'];
const INDIC_LANGUAGES = ['hi', 'pa', 'bn', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'or', 'ur'];

/**
 * Normalizes a locale/language string to its primary 2-letter ISO 639-1 language code,
 * but preserves -IN regional suffix for Indian languages and Indian English.
 *
 * @param {string} language
 * @returns {string}
 */
function normalizeLanguage(language = 'en-US') {
  if (!language || typeof language !== 'string') {
    return 'en';
  }
  const parts = language.trim().split(/[-_]/);
  const base = parts[0].toLowerCase();
  const region = parts.length > 1 ? parts[1].toUpperCase() : '';
  
  if ((base === 'en' && region === 'IN') || (INDIC_LANGUAGES.includes(base) && region === 'IN')) {
    return `${base}-${region}`;
  }
  if (INDIC_LANGUAGES.includes(base)) {
    return `${base}-IN`;
  }
  return base;
}

export function selectVoiceProvider(input = {}) {
  let language;
  if (typeof input === 'string') {
    language = input;
  } else if (input && typeof input === 'object') {
    language = input.language;
  }
  const normalizedLang = normalizeLanguage(language || 'en-US');
  console.log("[VOICE DEBUG] TTS LANGUAGE NORMALIZED:", normalizedLang);
  const decision = _selectVoiceProviderInternal(input, normalizedLang);
  console.log("[VOICE DEBUG] TTS PROVIDER SELECTED:", decision.provider);
  
  const voiceSelection = INDIAN_VOICE_MAP[normalizedLang]?.voice || 'default';
  console.log("[VOICE DEBUG] TTS VOICE SELECTED:", voiceSelection);
  
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

  const isIndic = normalizedLang.endsWith('-IN') && normalizedLang !== 'en-IN';
  const isIndianEnglish = normalizedLang === 'en-IN';
  const isArabic = (normalizedLang === 'ar');
  const isKnown = SUPPORTED_LANGUAGES.includes(normalizedLang.split('-')[0]);

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

  // Rule 3: en-IN (Indian English)
  if (isIndianEnglish) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'google',
      reason: 'Indian English voice'
    };
  }

  // Rule 4: Indic languages
  if (isIndic) {
    const provider = (normalizedLang === 'hi-IN' || normalizedLang === 'pa-IN') ? 'elevenlabs' : 'google';
    const fallback = provider === 'elevenlabs' ? 'google' : 'elevenlabs';
    
    return {
      language: normalizedLang,
      provider: provider,
      fallbackProvider: fallback,
      reason: `${normalizedLang} native voice fallback`
    };
  }

  // Rule 5: Arabic (ar) -> try ElevenLabs first, Google Arabic fallback
  if (isArabic) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'google',
      reason: 'ElevenLabs multilingual realism with Google Arabic dialect fallback'
    };
  }

  // Rule 6: Supported general conversational languages (en, es, fr, de, zh, ja)
  if (isKnown) {
    return {
      language: normalizedLang,
      provider: 'elevenlabs',
      fallbackProvider: 'openai',
      reason: 'ElevenLabs Multilingual v2 optimal for conversational realism'
    };
  }

  // Rule 7: Unknown languages default to ElevenLabs with Google fallback
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
