import { selectVoiceProvider } from '../services/voiceRouter.js';
import { synthesizeVoice } from '../services/voiceSynthesizer.js';
import { formatProsodyAndPhrasing } from './utils/languageModelEngine.js';

/**
 * Streaming Voice Connection API Route (/api/voice-stream)
 *
 * Replaces blocking REST calls with a real-time HTTP chunked streaming connection.
 * Employs VoiceRouter from services/voiceRouter.js to synthesize and stream
 * individual sentence chunks as soon as they are ready.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
  text: rawText,
  lang = 'en-US',
  personality = {},
  style = 'conversation',
  emotion = 'neutral',
  useCase = 'assistant'
} = req.body;

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

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkText = chunks[idx];
      if (!chunkText) continue;

      try {
        const voiceDecision = selectVoiceProvider({
    language: lang,
    style,
    emotion,
    useCase
});


const synthRes = await synthesizeVoice({
    text: chunkText,
    language: lang,
    provider: voiceDecision.provider,
    fallbackProvider: voiceDecision.fallbackProvider,
    emotion,
    style
});
        if (synthRes && synthRes.audioContent) {
          const payload = JSON.stringify({
            success: true,
            chunkIndex: idx,
            totalChunks: chunks.length,
            text: chunkText,
            audioContent: synthRes.audioContent,
            provider: synthRes.provider || 'streaming_voice_connection',
            format: 'mp3',
            done: false
          });
          res.write(payload + '\n');
        }
      } catch (chunkErr) {
        console.warn(`Streaming chunk ${idx} synthesis error:`, chunkErr.message);
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
