/**
 * Voice Providers Configuration (config/voiceProviders.js)
 *
 * Centralized configuration object defining supported TTS providers,
 * their supported languages, primary/fallback provider designations,
 * recommended use cases, and voice engine settings.
 */

export const VOICE_PROVIDERS = {
  elevenlabs: {
    name: "ElevenLabs Multilingual v2",
    languages: ["en", "hi", "pa", "ar", "es", "fr", "de", "zh", "ja"],
    primaryProvider: true,
    fallbackProvider: false,
    useCases: ["conversation", "storytelling", "general"],
    model: "eleven_multilingual_v2",
    voiceSettings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.35,
      use_speaker_boost: true
    }
  },

  google: {
    name: "Google Neural Multilingual & Indic TTS",
    languages: ["en", "hi", "pa", "ar", "es", "fr", "de", "zh", "ja"],
    primaryProvider: false,
    fallbackProvider: true,
    useCases: ["fallback", "indic_pronunciation", "arabic_dialect"],
    engine: "neural",
    voiceSettings: {
      rate: 1.0,
      pitch: 1.0,
      format: "mp3"
    }
  },

  openai: {
    name: "OpenAI TTS-1 Multilingual",
    languages: ["en", "hi", "es", "fr", "de", "zh", "ja"],
    primaryProvider: true,
    fallbackProvider: true,
    useCases: ["customer_support", "support", "low_latency_conversation"],
    model: "tts-1",
    defaultVoice: "nova",
    voiceSettings: {
      speed: 1.0,
      response_format: "mp3"
    }
  },

  tacotron: {
    name: "Tacotron 2 + MelGAN GAN Vocoder",
    languages: ["en", "hi", "pa"],
    primaryProvider: false,
    fallbackProvider: true,
    useCases: ["custom_prosody", "gan_vocoder_experimental"],
    engine: "seq2seq_gan_vocoder",
    voiceSettings: {
      sampleRate: 22050,
      format: "wav"
    }
  }
};

export default VOICE_PROVIDERS;
