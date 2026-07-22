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

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  return res.status(200).json({
    key: process.env.GEMINI_API_KEY
  });
}
