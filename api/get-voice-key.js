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

  let rawKey = process.env.VALID_API_KEYS || process.env.VALID_API_KEY || process.env.LIVE_API_KEY || process.env.GEMINI_API_KEY || '';
  let apiKey = '';
  try {
    if (rawKey.trim().startsWith('[')) {
      const parsed = JSON.parse(rawKey);
      if (Array.isArray(parsed) && parsed.length > 0) {
        apiKey = String(parsed[0]).trim();
      }
    }
  } catch (e) {
    // Not JSON, continue to normal parsing
  }
  if (!apiKey && rawKey) {
    apiKey = rawKey.split(',')[0].replace(/[\[\]"']/g, '').trim();
  } else if (apiKey) {
    apiKey = apiKey.replace(/[\[\]"']/g, '').trim();
  }

  const modalApiKey = process.env.MODAL_API_KEY || 'sk-my-custom-ai-key-2026';
  const chatApiBaseUrl = process.env.CHAT_API_BASE_URL || 'https://mannskahlon84--chat-llm-voice-agent-fastapi-app.modal.run/v1';

  return res.status(200).json({
    key: apiKey || modalApiKey,
    modalKey: modalApiKey,
    chatBaseUrl: chatApiBaseUrl
  });
}
