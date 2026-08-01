import { VoiceRouter } from '../services/voiceRouter.js';

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
    const { text, lang = 'en-US', personality = {} } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }

    const synthesisResult = await VoiceRouter.synthesizeSpeech({
      text,
      lang,
      personality
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
