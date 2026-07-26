export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // To prevent random bots, we can check the origin
  const origin = req.headers.origin || req.headers.referer;
  const isVercel = origin && origin.includes('vercel.app');
  const isLocal = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));

  // Allow if it's coming from our own domains
  if (!isVercel && !isLocal) {
    // In a strict production environment, we would also verify req.headers.authorization (Firebase token) here.
    console.warn("Suspicious request to /api/get-voice-key from origin:", origin);
  }

  // 1) Find a valid Google Gemini key (starts with 'AIza' or 'AQ.') for Gemini Live WebSocket
  const candidateKeys = [
    process.env.GEMINI_API_KEY,
    process.env.LIVE_API_KEY,
    process.env.VALID_API_KEYS,
    process.env.VALID_API_KEY
  ].filter(Boolean);

  let geminiApiKey = '';
  for (const val of candidateKeys) {
    const str = String(val).replace(/[\[\]"']/g, '').trim();
    const parts = str.split(',').map(k => k.trim());
    for (const p of parts) {
      if (p.startsWith('AIza') || p.startsWith('AQ.')) {
        geminiApiKey = p;
        break;
      }
    }
    if (geminiApiKey) break;
  }

  // If no AIza/AQ key found, fall back to GEMINI_API_KEY if present (but never use 'sk-' for Gemini Live)
  if (!geminiApiKey && process.env.GEMINI_API_KEY && !String(process.env.GEMINI_API_KEY).trim().startsWith('sk-')) {
    geminiApiKey = String(process.env.GEMINI_API_KEY).trim();
  }

  const modalApiKey = process.env.MODAL_API_KEY || 'sk-my-custom-ai-key-2026';
  const chatApiBaseUrl = process.env.CHAT_API_BASE_URL || 'https://mannskahlon84--chat-llm-voice-agent-fastapi-app.modal.run/v1';

  return res.status(200).json({
    key: geminiApiKey,
    modalKey: modalApiKey,
    chatBaseUrl: chatApiBaseUrl
  });
}
