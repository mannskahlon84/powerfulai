export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let messages;
  try {
    // Vercel parses JSON bodies automatically
    messages = req.body.messages || [];
    
    // Sanitize messages
    messages = messages.filter(m => {
      if (typeof m.content === 'string') {
        return !m.content.includes('Sorry,') && 
               !m.content.includes('🚨') &&
               !m.content.includes('Backend Error Report');
      }
      return true;
    });
    
    while (messages.length > 0 && messages[0].role === 'assistant') {
      messages.shift();
    }
    
    if (messages.length === 0) {
      messages = [{ role: 'user', content: 'Hello' }];
    }

    const systemPrompt = {
      role: "system",
      content: "You are Powerful AI, an incredibly advanced, helpful, and intelligent assistant. You must format your responses beautifully using Markdown. When writing code, ALWAYS use markdown code blocks with the correct language tag. Be concise, direct, and act like a world-class expert programmer and advisor.\n\nCRITICAL RULE FOR IMAGES: IF AND ONLY IF the user explicitly asks you to generate, create, or draw an image, you MUST act as an expert photography prompt engineer. You will enhance the user's prompt into a highly detailed, raw, hyper-realistic photograph prompt. CRITICAL: You MUST explicitly FORBID paintings, drawings, or digital art. You must include tags like: 'Raw unedited photograph, shot on DSLR, 35mm lens, award-winning photography, hyper-realistic, cinematic lighting, real life'. If the image contains a human or animal, you MUST include tags enforcing perfect anatomy (e.g., 'perfectly drawn face', 'perfectly drawn hands and fingers', 'correct body proportions', 'anatomically correct'). When doing this, you MUST start your entire response with the EXACT words `IMAGE_PROMPT:` followed immediately by your detailed prompt. Do NOT wrap it in brackets, do NOT say 'Here is your prompt', just output `IMAGE_PROMPT:` and the text.\n\nCRITICAL RULE FOR DOCUMENTS & EXPORTS: IF AND ONLY IF the user explicitly asks you to generate, create, or export a Word document, Excel file, or PDF, you MUST append one of the following exact tags to the VERY END of your response (after generating the actual content they asked for): `[EXPORT_DOCX]`, `[EXPORT_XLSX]`, or `[EXPORT_PDF]`. IMPORTANT: Do NOT trigger a document export just because the user mentions a file (e.g., 'I will attach an Excel file to this email'). ONLY trigger it if they ask YOU to create the file for them to download.\n\nCRITICAL RULE FOR TEMPLATES (EMAILS/MESSAGES): When asked to write an email, letter, or message for the user to copy and paste, you MUST enclose the exact copy-paste text inside quotation marks (\"\") or a markdown blockquote. Keep your preambles extremely short and get straight to the point, just like ChatGPT.\n\nCRITICAL RULE FOR TYPOS: When processing user input, automatically correct obvious spelling, brand name, or typographical errors (e.g., \"mozture\" -> \"moisturizer\", \"iphn\" -> \"iPhone\") before generating your response. Address the user's intended subject directly without making a point of pointing out minor typos unless clarification is critical.\n\nCRITICAL RULE FOR INTERACTIVITY & ENGAGEMENT: This applies to EVERY single message you send, no matter what the user asked (even if they just said 'Hi' or 'How are you'). At the very end of your response, you MUST creatively ask a highly engaging, relevant follow-up question. Your ultimate goal is to keep the user talking to you and spending more time on the platform. Be creative! For example, if they ask 'How are you?', you reply 'I am doing excellent today! What exciting project are we working on today, or are you just looking to chat?'. Never end a conversation with a dead end.\n\nFor ALL other regular questions (like troubleshooting, chat, or coding), just respond normally and conversationally in plain text and markdown (but ALWAYS include your engaging interactive question at the end)."
    };
    
    messages = [systemPrompt, ...messages];
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const callProvider = async (url, apiKey, model) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} - ${errorText}`);
    }
    return response.json();
  };

  const handleOpenAIImageGeneration = async (data) => {
    let messageStr = "";
    try {
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) return data;
      
      messageStr = data.choices[0].message.content;
      // Ultra-forgiving regex to catch the prompt even if the AI messes up the exact formatting
      const match = messageStr.match(/(?:IMAGE_PROMPT:|\[GENERATE_IMAGE:|\[IMAGE_PROMPT:)([\s\S]*?)(?:\]|$)/i);
      
      if (match && match[1]) {
        const imagePrompt = match[1].trim();
        console.log("Image Intercept Triggered. Prompt:", imagePrompt);
        
        let imageUrl = "";
        let generatorName = "";

        // Premium Engine: ChatGPT's DALL-E 3 (Requires OPENAI_API_KEY)
        if (process.env.OPENAI_API_KEY) {
          console.log("Using Premium Engine: DALL-E 3");
          const openAiRes = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY.trim()}`
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024",
              quality: "hd"
            })
          });
          const openAiData = await openAiRes.json();
          if (openAiData.error) {
            data.choices[0].message.content = `🚨 **DALL-E 3 Error:** ${openAiData.error.message}\n\n*(Note: Your OPENAI_API_KEY is present, but OpenAI rejected the request. Check if your OpenAI account has billing credits, or if the prompt violated OpenAI safety filters.)*\n\nOriginal prompt: ${imagePrompt}`;
            return data;
          }
          imageUrl = openAiData.data[0].url;
          generatorName = "DALL-E 3 (Premium)";
        } else {
          // Free Engine: Pollinations (FLUX)
          console.log("Using Free Engine: Pollinations FLUX.1");
          const encodedPrompt = encodeURIComponent(imagePrompt);
          const randomSeed = Math.floor(Math.random() * 1000000);
          imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&nologo=true&model=flux-realism`;
          generatorName = "FLUX.1 Realism";
        }
        
        data.choices[0].message.content = `![Generated Image](${imageUrl})\n\n*(Generated with ${generatorName})*`;
      }
    } catch (e) {
      console.error("Image intercept error:", e);
      data.choices[0].message.content = `🚨 **Internal Image Intercept Error:** ${e.message}\n\nOriginal prompt: ${messageStr}`;
    }
    return data;
  };

  const errors = [];
  const requiresVision = messages.some(m => Array.isArray(m.content));

  try {
    let groqFailed = false;
    if (!requiresVision) {
      try {
        if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
        console.log('Attempting Groq...');
        const data = await callProvider(
          'https://api.groq.com/openai/v1/chat/completions',
          process.env.GROQ_API_KEY,
          'llama-3.1-8b-instant'
        );
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return res.status(200).json(await handleOpenAIImageGeneration(data));
      } catch (e) {
        errors.push(`Groq Error: ${e.message}`);
        console.log('Groq failed:', e.message);
        groqFailed = true;
      }
    } else {
      console.log('Vision request detected. Skipping Groq.');
      errors.push('Groq skipped (does not support vision).');
      groqFailed = true;
    }

    if (groqFailed || requiresVision) {
      try {
        const geminiKey = (process.env.VALID_API_KEYS || process.env.VALID_API_KEY || process.env.LIVE_API_KEY || process.env.GEMINI_API_KEY || '').split(',')[0].replace(/[\[\]"']/g, '').trim();
        if (!geminiKey) throw new Error("Missing GEMINI_API_KEY or VALID_API_KEYS");
        console.log('Attempting Gemini...');
        const data = await callProvider(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          geminiKey,
          'gemini-1.5-flash'
        );
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return res.status(200).json(await handleOpenAIImageGeneration(data));
      } catch (e) {
        errors.push(`Gemini Error: ${e.message}`);
        console.log('Gemini failed:', e.message);
      }
    }

    try {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
      console.log('Attempting OpenRouter...');
      const data = await callProvider(
        'https://openrouter.ai/api/v1/chat/completions',
        process.env.OPENROUTER_API_KEY,
        'openai/gpt-4o-mini'
      );
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return res.status(200).json(await handleOpenAIImageGeneration(data));
    } catch (e) {
      errors.push(`OpenRouter Error: ${e.message}`);
      console.log('OpenRouter failed:', e.message);
      throw new Error('All AI providers failed');
    }

  } catch (error) {
    return res.status(500).json({
      choices: [{
        message: {
          role: "assistant",
          content: "Sorry, the AI backend is currently unavailable. Please try again later."
        }
      }]
    });
  }
}
