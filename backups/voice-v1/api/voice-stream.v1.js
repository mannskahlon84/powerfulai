import { formatProsodyAndPhrasing } from './utils/languageModelEngine.js';

/**
 * Streaming Voice Connection API Route (/api/voice-stream)
 * 
 * Replaces blocking REST /api/tts with a real-time chunked streaming voice connection.
 * Streams audio segments as soon as each sentence chunk is synthesized, minimizing
 * first-byte audio latency and enabling continuous conversational dialog.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text: rawText, lang = 'en-US', personality = {} } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Text is required for streaming voice connection' });
    }

    // Configure headers for real-time HTTP chunked streaming connection
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Apply natural reading style (prosody, phrasing, cadence, breathing pauses)
    const text = formatProsodyAndPhrasing(rawText, personality);

    // Split text into natural sentence chunks for incremental streaming synthesis
    const sentences = text.match(/[^.!?,\r\n]+[.!?,\r\n]*/g) || [text];
    const chunks = [];
    let currentChunk = '';
    for (const s of sentences) {
      if ((currentChunk + s).length <= 160) {
        currentChunk += s;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = s;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    const langLower = (lang || 'en-IN').toLowerCase();
    const isIndicOrSouthAsian = langLower.includes('hi') || langLower.includes('pa') || langLower.includes('en') || langLower.includes('bn') || langLower.includes('ta') || langLower.includes('te');

    let langCode = 'en-in';
    if (langLower.startsWith('hi')) langCode = 'hi-in';
    else if (langLower.startsWith('pa')) langCode = 'pa-in';
    else if (langLower.startsWith('en')) langCode = 'en-in';
    else langCode = langLower.split('-')[0];

    // Stream each synthesized sentence chunk immediately down the wire
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkText = chunks[idx];
      if (!chunkText) continue;

      let chunkAudioBase64 = null;
      let providerUsed = null;

      // 1. Language-Based Router (Priority 1 for Indic / South Asian accents)
      if (isIndicOrSouthAsian) {
        try {
          const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunkText)}`;
          const gRes = await fetch(gUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (gRes.ok) {
            const ab = await gRes.arrayBuffer();
            if (ab && ab.byteLength > 0) {
              chunkAudioBase64 = Buffer.from(ab).toString('base64');
              providerUsed = 'language_based_router_streaming';
            }
          }
        } catch (err) {
          console.warn(`Streaming voice chunk ${idx} Google Neural error:`, err.message);
        }
      }

      // 2. Try ElevenLabs Multilingual v2 if Language-Based Router didn't return
      if (!chunkAudioBase64 && process.env.ELEVENLABS_API_KEY) {
        try {
          const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'zcAOhNBS3c14rBihAFp1';
          const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': process.env.ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
              text: chunkText,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.35,
                use_speaker_boost: true
              }
            })
          });
          if (elRes.ok) {
            const ab = await elRes.arrayBuffer();
            chunkAudioBase64 = Buffer.from(ab).toString('base64');
            providerUsed = 'elevenlabs_streaming';
          }
        } catch (elErr) {
          console.warn(`Streaming voice chunk ${idx} ElevenLabs error:`, elErr.message);
        }
      }

      // 3. Try OpenAI TTS-1 Nova
      if (!chunkAudioBase64 && process.env.OPENAI_API_KEY) {
        try {
          const oaRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: chunkText,
              voice: 'nova',
              response_format: 'mp3',
              speed: lang.includes('hi') || lang.includes('pa') ? 0.96 : 1.0
            })
          });
          if (oaRes.ok) {
            const ab = await oaRes.arrayBuffer();
            chunkAudioBase64 = Buffer.from(ab).toString('base64');
            providerUsed = 'openai_tts_streaming';
          }
        } catch (oaErr) {
          console.warn(`Streaming voice chunk ${idx} OpenAI error:`, oaErr.message);
        }
      }

      // 4. Universal Google Neural Multilingual TTS Fallback
      if (!chunkAudioBase64) {
        try {
          const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunkText)}`;
          const gRes = await fetch(gUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (gRes.ok) {
            const ab = await gRes.arrayBuffer();
            if (ab && ab.byteLength > 0) {
              chunkAudioBase64 = Buffer.from(ab).toString('base64');
              providerUsed = 'google_neural_multilingual_streaming';
            }
          }
        } catch (gErr) {
          console.warn(`Streaming voice chunk ${idx} universal Google error:`, gErr.message);
        }
      }

      // Write chunk to stream
      if (chunkAudioBase64) {
        const payload = JSON.stringify({
          success: true,
          chunkIndex: idx,
          totalChunks: chunks.length,
          text: chunkText,
          audioContent: chunkAudioBase64,
          provider: providerUsed || 'streaming_voice_connection',
          format: 'mp3',
          done: false
        });
        res.write(payload + '\n');
      }
    }

    // Send closing stream frame
    res.write(JSON.stringify({ success: true, done: true }) + '\n');
    res.end();
  } catch (err) {
    console.error("Streaming voice connection error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Streaming voice connection failed', details: err.message });
    }
    res.end();
  }
}
