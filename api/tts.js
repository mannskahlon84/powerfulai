import { selectVoiceProvider } from '../services/voiceRouter.js';
import { synthesizeVoice } from '../services/voiceSynthesizer.js';

/**
 * Text-to-Speech API Endpoint (/api/tts)
 *
 * Employs VoiceRouter from services/voiceRouter.js to dynamically select and
 * execute the optimal TTS engine based on target language, phonetics, and available providers.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, lang = 'en-US', personality = {}, emotion = 'neutral', style = 'conversation', useCase = 'assistant' } = req.body;
    console.log("[VOICE DEBUG] TTS LANGUAGE RECEIVED:", lang);

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }

    const voiceDecision = selectVoiceProvider({
      language: lang,
      style,
      emotion,
      useCase
    });
    console.log("[VOICE DEBUG] RESPONSE LANGUAGE DETECTED:", lang);
    console.log("[VOICE DEBUG] FINAL TTS LANGUAGE:", voiceDecision.language);
    console.log("[VOICE DEBUG] TTS PROVIDER:", voiceDecision.provider);

    const synthesisResult = await synthesizeVoice({
      text,
      language: lang,
      provider: voiceDecision.provider,
      fallbackProvider: voiceDecision.fallbackProvider,
      emotion,
      style
    });

    return res.status(200).json(synthesisResult);
  } catch (err) {
    console.error("TTS endpoint error:", err);
    return res.status(500).json({
      error: 'Failed to generate TTS audio',
      details: err.message
    });
  }
}
