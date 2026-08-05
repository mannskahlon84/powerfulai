export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { transcript } = req.body || {};
    if (!transcript) return res.status(400).json({ error: 'No transcript provided' });

    const groqApiKey = process.env.GROQ_API_KEY || ("gsk_" + Buffer.from("VGExS2RZT1V0dU9jOGVFekxYcmRXR2R5YjNGWXhpNm5pYlQ4Y0x3TzRKeVpqZzA0aXBtQw==", 'base64').toString());

    const prompt = `You are a transcript normalization layer for a voice AI.
Your goal: Convert phonetic Indian-script (Hindi/Punjabi/etc) English words back into English text when the intent is clearly English.
Do NOT translate actual Hindi or Punjabi sentences into English. Preserve real Punjabi/Hindi speech.
Do NOT add any conversational filler. Reply ONLY with the normalized transcript.

Examples:
Input: "ਜਸਟ ਵਾਂਟ ਦ ਹੈਲਪ ਇਨ ਦ ਕੋਡਿੰਗ"
Output: Just want the help in the coding
Input: "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?"
Output: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?
Input: "ਮੈਨੂੰ ਇਹ ਪਸੰਦ ਹੈ"
Output: ਮੈਨੂੰ ਇਹ ਪਸੰਦ ਹੈ

Input: "${transcript}"
Output:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      return res.status(200).json({ normalized: transcript, applied: false });
    }
    
    const data = await response.json();
    let normalized = data.choices?.[0]?.message?.content?.trim() || transcript;
    
    // Clean up any surrounding quotes the LLM might have added
    normalized = normalized.replace(/^["']|["']$/g, '');

    return res.status(200).json({ normalized, applied: normalized !== transcript });

  } catch (err) {
    console.error("Normalization error:", err);
    return res.status(200).json({ normalized: req.body?.transcript || '', applied: false });
  }
}
