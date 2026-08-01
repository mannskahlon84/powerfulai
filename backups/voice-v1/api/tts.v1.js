import { formatProsodyAndPhrasing } from './utils/languageModelEngine.js';
import { tacotron2Model, melGANVocoder } from './utils/tacotronMelgan.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text: rawText, lang = 'en-US', voiceType = 'multilingual', personality = {} } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    // Apply natural reading style (prosody, phrasing, cadence, breathing pauses)
    const text = formatProsodyAndPhrasing(rawText, personality);

    // 1. Language-Based Router (Priority 1)
    // Automatically routes speech synthesis based on the target language to ensure native accent and fluency
    const langLower = (lang || 'en-IN').toLowerCase();
    const isIndicOrSouthAsian = langLower.includes('hi') || langLower.includes('pa') || langLower.includes('en') || langLower.includes('bn') || langLower.includes('ta') || langLower.includes('te');

    if (isIndicOrSouthAsian) {
      try {
        let langCode = 'en-in';
        if (langLower.startsWith('hi')) langCode = 'hi-in';
        else if (langLower.startsWith('pa')) langCode = 'pa-in';
        else if (langLower.startsWith('en')) langCode = 'en-in';
        else langCode = langLower.split('-')[0];

        const sentences = text.match(/[^.!?,\r\n]+[.!?,\r\n]*/g) || [text];
        const chunks = [];
        let currentChunk = '';
        for (const s of sentences) {
          if ((currentChunk + s).length <= 180) {
            currentChunk += s;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = s;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());

        const audioBuffers = [];
        for (const chunk of chunks) {
          if (!chunk) continue;
          const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunk)}`;
          const gRes = await fetch(gUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (gRes.ok) {
            const ab = await gRes.arrayBuffer();
            if (ab && ab.byteLength > 0) {
              audioBuffers.push(Buffer.from(ab));
            }
          }
        }

        if (audioBuffers.length > 0) {
          const fullBuffer = Buffer.concat(audioBuffers);
          const base64Audio = fullBuffer.toString('base64');
          return res.status(200).json({
            success: true,
            provider: 'language_based_router',
            router: 'Language-Based Router (Priority 1 - Indic/Native Accent)',
            audioContent: base64Audio,
            format: 'mp3'
          });
        }
      } catch (routerErr) {
        console.warn("Language-Based Router error:", routerErr.message);
      }
    }

    // 1. ElevenLabs Multilingual v2 (Optimal for Indic languages: Hindi, Punjabi, Devanagari, Gurmukhi phonetics)
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      try {
        const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'zcAOhNBS3c14rBihAFp1'; // Professional Indian English & Indic Multilingual voice
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsKey
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.35,
              use_speaker_boost: true
            }
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          return res.status(200).json({
            success: true,
            provider: 'elevenlabs_multilingual_v2',
            audioContent: base64Audio,
            format: 'mp3'
          });
        }
      } catch (elevenErr) {
        console.warn("ElevenLabs TTS fallback error:", elevenErr.message);
      }
    }

    // 2. OpenAI TTS-1 Multilingual (High fluency for Hindi Devanagari & Punjabi Gurmukhi phonetics)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: 'nova', // Nova has natural inflection across multilingual Indic phonetics
            response_format: 'mp3',
            speed: lang.includes('hi') || lang.includes('pa') ? 0.96 : 1.0
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          return res.status(200).json({
            success: true,
            provider: 'openai_tts_multilingual',
            audioContent: base64Audio,
            format: 'mp3'
          });
        }
      } catch (openAiErr) {
        console.warn("OpenAI TTS fallback error:", openAiErr.message);
      }
    }

    // 4. Tacotron 2 (Sequence-to-Sequence Acoustic Model) & MelGAN (GAN Vocoder) Fallback
    try {
      const tacotronProsody = tacotron2Model.generateMelSpectrogramProsody(text, lang, personality);
      const melGANRes = await melGANVocoder.synthesizeWaveform(tacotronProsody);
      if (melGANRes && melGANRes.audioContent) {
        return res.status(200).json(melGANRes);
      }
    } catch (tErr) {
      console.warn("Tacotron 2 + MelGAN fallback error:", tErr.message);
    }

    // 5. Universal Google Neural Multilingual & Indic TTS (Zero-Key Native Audio Support for Hindi hi-IN, Punjabi pa-IN, en-IN)
    try {
      let langCode = (lang || 'en-IN').toLowerCase();
      if (langCode === 'en' || langCode === 'en-us' || langCode === 'en-gb' || langCode.includes('en')) {
        langCode = 'en-in'; // Enforce Professional Native Indian English (en-IN) accent so it never sounds like someone from outside India
      } else if (langCode.startsWith('hi')) {
        langCode = 'hi-in';
      } else if (langCode.startsWith('pa')) {
        langCode = 'pa-in';
      } else {
        langCode = langCode.split('-')[0];
      }
      // Split text into chunks of <= 180 chars on punctuation or spaces to respect URL limits
      const sentences = text.match(/[^.!?,\r\n]+[.!?,\r\n]*/g) || [text];
      const chunks = [];
      let currentChunk = '';
      for (const s of sentences) {
        if ((currentChunk + s).length <= 180) {
          currentChunk += s;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = s;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());

      const audioBuffers = [];
      for (const chunk of chunks) {
        if (!chunk) continue;
        const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunk)}`;
        const gRes = await fetch(gUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (gRes.ok) {
          const ab = await gRes.arrayBuffer();
          if (ab && ab.byteLength > 0) {
            audioBuffers.push(Buffer.from(ab));
          }
        }
      }

      if (audioBuffers.length > 0) {
        const fullBuffer = Buffer.concat(audioBuffers);
        const base64Audio = fullBuffer.toString('base64');
        return res.status(200).json({
          success: true,
          provider: 'google_neural_multilingual',
          audioContent: base64Audio,
          format: 'mp3'
        });
      }
    } catch (gErr) {
      console.warn("Google Neural TTS fallback error:", gErr.message);
    }

    // 4. Fallback to Browser Calibrated Indic TTS
    return res.status(200).json({
      success: true,
      provider: 'browser-calibrated',
      calibratedLang: lang,
      useBrowserFallback: true
    });
  } catch (err) {
    console.error("TTS endpoint error:", err);
    return res.status(500).json({ error: 'Failed to generate TTS audio', details: err.message });
  }
}
