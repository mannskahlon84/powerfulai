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
      }),
      signal: AbortSignal.timeout(4500)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} - ${errorText}`);
    }
    return response.json();
  };

  const handleOpenAIImageGeneration = async (data, messages) => {
    let messageStr = "";
    try {
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) return data;
      
      messageStr = data.choices[0].message.content;
      const lastUserMsg = messages && messages.length > 0 ? (typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '') : '';

      // Check if AI output OR user input requested image generation or @avatar tag
      const aiMatch = messageStr.match(/(?:IMAGE_PROMPT:|\[GENERATE_IMAGE:|\[IMAGE_PROMPT:)([\s\S]*?)(?:\]|$)/i);
      const userMatch = lastUserMsg.match(/(?:IMAGE_PROMPT:|\[IMAGE_PROMPT:)([\s\S]*?)(?:\]|$)/i);
      const isDirectImageCmd = /^(create|generate|make|draw|show|render|cretae|generat)\b.*\b(image|picture|photo|pic|avatar|clone)\b/i.test(lastUserMsg) || /@\w+/i.test(lastUserMsg);

      let imagePrompt = "";
      if (aiMatch && aiMatch[1]) {
        imagePrompt = aiMatch[1].trim();
      } else if (userMatch && userMatch[1]) {
        imagePrompt = userMatch[1].trim();
      } else if (isDirectImageCmd) {
        imagePrompt = lastUserMsg.trim();
      }
      
      if (imagePrompt) {
        console.log("Image Intercept Triggered. Prompt:", imagePrompt);
        
        let imageUrl = "";
        let generatorName = "";
        const modalApiKey = (process.env.MODAL_API_KEY || 'sk-my-custom-ai-key-2026').trim();
        const imageApiBaseUrl = (process.env.IMAGE_API_BASE_URL || 'https://flux-image-gen-backend-git-520088884410.asia-south2.run.app/api/v1').replace(/\/$/, '');
        let modalSuccess = false;
        let modalError = "Unknown error";
        let openAiError = "";

        // Priority 1: Custom 24/7 FLUX.1 (Dev & Pro) Image Generation Cloud API (with fallback to Modal GPU)
        const tryEndpoints = [
          `https://flux-image-gen-backend-git-520088884410.asia-south2.run.app/api/v1/images/generate`,
          `${imageApiBaseUrl}/images/generate`,
          `${imageApiBaseUrl}/images/generations`,
          `${imageApiBaseUrl}/generate`,
          `https://mannskahlon84--image-gen-service-fastapi-app.modal.run/v1/images/generate`,
          `https://mannskahlon84--image-gen-service-fastapi-app.modal.run/v1/images/generations`
        ];

        console.log("Using Custom GPU Image Engine:", imageApiBaseUrl);
        for (const targetUrl of tryEndpoints) {
          try {
            console.log("Attempting image endpoint:", targetUrl);
            const isFluxEndpoint = targetUrl.includes('flux-image-gen') || targetUrl.includes('/images/generate');
            const bodyPayload = isFluxEndpoint ? {
              prompt: imagePrompt,
              model_type: "dev",
              aspect_ratio: "16:9",
              loras: [
                {
                  "name": "cyberpunk_human",
                  "scale": 0.85
                }
              ],
              guidance_scale: 3.5,
              num_inference_steps: 28,
              output_format: "webp",
              n: 1,
              size: "1024x1024"
            } : {
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024"
            };

            const modalRes = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${modalApiKey}`
              },
              body: JSON.stringify(bodyPayload),
              signal: AbortSignal.timeout(20000)
            });

            const contentType = modalRes.headers.get('content-type') || '';
            if (modalRes.ok && contentType.includes('application/json')) {
              const modalData = await modalRes.json();
              imageUrl = modalData?.url || 
                         modalData?.image_url || 
                         modalData?.image || 
                         modalData?.result || 
                         modalData?.output || 
                         modalData?.data?.[0]?.url || 
                         modalData?.data?.url ||
                         modalData?.images?.[0] || '';
              if (!imageUrl && (modalData?.base64 || modalData?.image_base64 || modalData?.data?.[0]?.b64_json)) {
                const b64 = modalData.base64 || modalData.image_base64 || modalData.data?.[0]?.b64_json;
                imageUrl = b64.startsWith('data:') ? b64 : `data:image/webp;base64,${b64}`;
              }
              if (imageUrl) {
                generatorName = targetUrl.includes('flux-image-gen') ? "FLUX.1 (Dev & Pro) 24/7 Cloud API" : "Custom Modal GPU Image Engine";
                modalSuccess = true;
                break;
              }
            } else {
              modalError = `HTTP ${modalRes.status} (${modalRes.statusText})`;
            }
          } catch (err) {
            modalError = err.message;
            console.log(`Endpoint ${targetUrl} failed:`, err.message);
          }
        }

        // Priority 2: Premium Engine: ChatGPT's DALL-E 3 or DALL-E 2 (Requires OPENAI_API_KEY)
        if (!modalSuccess && process.env.OPENAI_API_KEY) {
          for (const modelName of ["dall-e-3", "dall-e-2"]) {
            try {
              console.log(`Using Premium Engine: ${modelName}`);
              const openAiRes = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.OPENAI_API_KEY.trim()}`
                },
                body: JSON.stringify({
                  model: modelName,
                  prompt: imagePrompt,
                  n: 1,
                  size: "1024x1024"
                }),
                signal: AbortSignal.timeout(25000)
              });
              const openAiData = await openAiRes.json();
              if (openAiData.error) {
                openAiError = openAiData.error.message;
              } else {
                imageUrl = openAiData.data[0].url;
                generatorName = `${modelName.toUpperCase()} (Premium)`;
                modalSuccess = true;
                break;
              }
            } catch (err) {
              openAiError = err.message;
              console.log(`${modelName} fallback:`, err.message);
            }
          }
        } 
        
        // NEVER fall back to Pollinations! If Modal & OpenAI fail, return a clear, actionable error message.
        if (!modalSuccess) {
          let errDetail = `**GPU Engine Error:** \`${modalError}\``;
          if (openAiError) {
            errDetail += `\n**OpenAI Error:** \`${openAiError}\``;
          }
          data.choices[0].message.content = `🚨 **Custom GPU Image Engine Currently Unreachable**\n\nWe attempted to generate your image using your Custom 24/7 FLUX.1 Cloud API (\`${imageApiBaseUrl}\`), but the server could not be reached or returned an error.\n\n${errDetail}\n\n**How to fix:**\n1. Ensure your Google Cloud Run FLUX.1 container is deployed and online.\n2. In Vercel -> **Settings** -> **Environment Variables**, check **\`IMAGE_API_BASE_URL\`**.\n\n*(Original prompt: ${imagePrompt})*`;
        } else {
          data.choices[0].message.content = `![Generated Image](${imageUrl})\n\n*(Generated with ${generatorName})*`;
        }
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
    // Check for Music / Song Generation Request via Modal
    const lastUserMsg = messages && messages.length > 0 ? (typeof messages[messages.length - 1].content === 'string' ? messages[messages.length - 1].content : '') : '';
    const isMusicRequest = /(?:WRITE_A_SONG:|MUSIC_PROMPT:|\[MUSIC_PROMPT:|\b(write|create|generate|make|compose|sing|record)\b.*\b(song|music|track|beat|melody|tune)\b)/i.test(lastUserMsg);
    if (isMusicRequest) {
      const musicPrompt = lastUserMsg.replace(/^(write a song about|create a song about|generate a song about|create song|create music)/i, '').trim() || lastUserMsg;
      const musicApiUrl = process.env.MUSIC_API_URL || 'https://mannskahlon84--music-svc-generator-fastapi-app.modal.run/generate-custom-song';
      const modalApiKey = (process.env.MODAL_API_KEY || 'sk-my-custom-ai-key-2026').trim();
      console.log("Music Intercept Triggered. Using Custom Modal Music Service:", musicApiUrl, "Prompt:", musicPrompt);
      try {
        const musicRes = await fetch(musicApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${modalApiKey}`
          },
          body: JSON.stringify({
            prompt: musicPrompt,
            lyrics: musicPrompt
          }),
          signal: AbortSignal.timeout(20000)
        });
        if (musicRes.ok) {
          const musicData = await musicRes.json();
          const audioUrl = musicData?.audio_url || musicData?.url || musicData?.song_url || musicData?.music_url || (musicData?.data && musicData.data[0]?.url) || '';
          const lyrics = musicData?.lyrics || musicData?.text || '';
          let replyContent = `🎵 **Custom AI Song Generated via Modal Engine**\n*Prompt: "${musicPrompt}"*\n\n`;
          if (audioUrl) {
            replyContent += `<audio controls src="${audioUrl}" class="w-full mt-2 rounded-xl"></audio>\n\n[**⬇️ Download Audio/MP3**](${audioUrl})\n\n`;
          }
          if (lyrics) {
            replyContent += `### Lyrics:\n${lyrics}`;
          }
          if (!audioUrl && !lyrics) {
            replyContent += `*(Song request sent to Modal: ${JSON.stringify(musicData)})*`;
          }
          return res.status(200).json({
            choices: [{
              message: { role: 'assistant', content: replyContent }
            }]
          });
        }
      } catch (err) {
        console.log("Music Modal service fallback:", err.message);
      }
    }

    // Priority 0: Custom GPU Modal Chat & Voice LLM
    try {
      const chatApiBaseUrl = (process.env.CHAT_API_BASE_URL || 'https://mannskahlon84--chat-llm-voice-agent-fastapi-app.modal.run/v1').replace(/\/$/, '');
      const modalApiKey = (process.env.MODAL_API_KEY || 'sk-my-custom-ai-key-2026').trim();
      console.log('Attempting Custom Modal Chat & Voice LLM:', chatApiBaseUrl);
      const data = await callProvider(
        `${chatApiBaseUrl}/chat/completions`,
        modalApiKey,
        'gpt-4o-mini'
      );
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return res.status(200).json(await handleOpenAIImageGeneration(data, messages));
    } catch (e) {
      errors.push(`Custom Modal LLM Error: ${e.message}`);
      console.log('Custom Modal LLM fallback:', e.message);
    }

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
        return res.status(200).json(await handleOpenAIImageGeneration(data, messages));
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
        return res.status(200).json(await handleOpenAIImageGeneration(data, messages));
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
      return res.status(200).json(await handleOpenAIImageGeneration(data, messages));
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
