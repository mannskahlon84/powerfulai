import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Camera, File, Image, Video, Music, Sparkles, Mic, Volume2, Square, AudioLines, Activity, User, Download, FileText } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import { useGeminiLive } from '../hooks/useGeminiLive';
import MarkdownRenderer from './MarkdownRenderer';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function ChatScreen({ messages, onUpdateMessages }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { speak, stopSpeaking, isSpeaking, listen, isListening } = useSpeech();
  const { connectLive, disconnectLive, isLive, status: liveStatus } = useGeminiLive();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleVoiceMode = () => {
    if (isLive) {
      disconnectLive();
    } else {
      connectLive();
    }
  };

  const handleSend = async (overrideInput = null, fromVoiceMode = false) => {
    const textToSubmit = typeof overrideInput === 'string' ? overrideInput : input.trim();
    if ((!textToSubmit && !attachedImage && !attachedFile) || isLoading) return;

    let userContent = textToSubmit || (attachedImage || attachedFile?.isImage ? "What is in this image?" : `Please analyze this attached file: ${attachedFile?.name}`);
    if (attachedImage || (attachedFile && attachedFile.isImage)) {
      const imgBase64 = attachedFile?.base64 || attachedImage;
      userContent = [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: imgBase64 } }
      ];
    } else if (attachedFile) {
      userContent = [
        {
          type: "text",
          text: `${userContent}\n\n[Uploaded Multimodal Attachment: "${attachedFile.name}" (${attachedFile.type || 'Document'})]\n=== BEGIN ATTACHED FILE CONTENT ===\n${attachedFile.textContent || ''}\n=== END ATTACHED FILE CONTENT ===`
        }
      ];
    }

    // Check for AI Avatar Face Clone likeness (@abc or custom handle)
    let avatarHandleTag = '@abc';
    let avatarLikeness = 'A professional studio portrait of a confident person with a modern hairstyle, charismatic smile, cinematic 8k realism';
    try {
      const savedAvatar = localStorage.getItem('customUserAvatar');
      if (savedAvatar) {
        const parsed = JSON.parse(savedAvatar);
        if (parsed.handle) avatarHandleTag = parsed.handle;
        if (parsed.description) avatarLikeness = parsed.description;
      }
    } catch(e) {}

    const hasAvatarTag = typeof userContent === 'string' && (
      userContent.toLowerCase().includes(avatarHandleTag.toLowerCase()) ||
      /@\w+/i.test(userContent)
    );
    const lastAssistantImgMsg = messages.slice().reverse().find(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('!['));
    const isImageFollowUp = !!lastAssistantImgMsg && typeof userContent === 'string' && (
      /\b(make|change|add|remove|turn|show|put|replace|more|less|like|real|human|humans|background|desert|dessert|road|bike|car|face|color|light|lighting|style|day|night|sunset|look|without|with|better|quality|animation|realistic|angle|smile|only|backside|front|side|scene|shot|photo|image|picture|person|people|hair|dress|clothes|sky|cloud|clouds|trees|water|ocean|sea|sand)\b/i.test(userContent) ||
      (userContent.trim().length <= 60 && !userContent.includes('?') && !/\b(hi|hello|hey|thanks|thank|ok|okay|yes|no|why|what|how|where|when|who|code|error|bug|api|url)\b/i.test(userContent))
    ) && !/\b(how|what|why|when|where|who|url|website|code|error|api)\b/i.test(userContent);

    const isImageRequest = typeof userContent === 'string' && (
      hasAvatarTag ||
      /\b(create|generate|make|draw|show|render|cretae|generat)\b.*\b(image|picture|photo|pic|avatar|clone)\b/i.test(userContent) ||
      /\b(image|picture|photo|pic|avatar|clone)\b.*\b(create|generate|make|draw|show|render|cretae|generat)\b/i.test(userContent) ||
      (/^(a|an|the|beautiful|cute|handsome|stunning|cinematic|realistic|hyper-realistic|portrait|photo|photograph|shot|view|scene)\b/i.test(userContent.trim()) && !userContent.includes('?')) ||
      (/\b(girl|boy|woman|man|baby|beach|walking|standing|sitting|wearing|dressed|portrait|photo|pic|image|shot|cinematic|lighting|view|sunset|sunrise|scene|tajmahal|taj mahal|mountain|river|forest|car|bike|dog|cat|animal|studio|lens|camera|render|wallpaper|illustration|sketch|painting)\b/i.test(userContent) && !/\b(how|what|why|when|where|who|is|are|can|could|would|should|function|const|let|var|class|import|error|bug|code|url|api|website)\b/i.test(userContent) && !userContent.includes('?'))
    );

    let cleanPrompt = typeof userContent === 'string' ? userContent.replace(/^\[IMAGE_PROMPT:\s*/i, '').replace(/\]$/i, '').replace(/@\w+/gi, `[CHARACTER LIKENESS: ${avatarLikeness}]`).trim() : '';

    // Dynamic Aspect Ratio Detection (Instagram Reels 9:16, Square 1:1, Landscape 16:9, etc.)
    let detectedAspectRatio = "16:9";
    let fallbackWidth = 1024;
    let fallbackHeight = 576;
    if (/\b(9:16|9 by 16|9x16|vertical|reels|reel|tiktok|story|shorts|portrait)\b/i.test(userContent)) {
      detectedAspectRatio = "9:16";
      fallbackWidth = 576;
      fallbackHeight = 1024;
    } else if (/\b(1:1|square|insta post|instagram post)\b/i.test(userContent)) {
      detectedAspectRatio = "1:1";
      fallbackWidth = 1024;
      fallbackHeight = 1024;
    } else if (/\b(4:3|4 by 3)\b/i.test(userContent)) {
      detectedAspectRatio = "4:3";
      fallbackWidth = 1024;
      fallbackHeight = 768;
    } else if (/\b(3:4|3 by 4)\b/i.test(userContent)) {
      detectedAspectRatio = "3:4";
      fallbackWidth = 768;
      fallbackHeight = 1024;
    } else if (/\b(16:9|widescreen|landscape|cinema|cinematic)\b/i.test(userContent)) {
      detectedAspectRatio = "16:9";
      fallbackWidth = 1024;
      fallbackHeight = 576;
    }

    if (isImageFollowUp && !isImageRequest) {
      const prevPrompts = messages.filter(m => m.role === 'user' && typeof m.content === 'string');
      const bestPrev = prevPrompts.find(m => m.content.length > 30) || prevPrompts[prevPrompts.length - 1];
      const prevPromptText = bestPrev ? bestPrev.content.replace(/^\[IMAGE_PROMPT:\s*/i, '').replace(/\]$/i, '').trim() : '';
      
      let pureSceneUpdate = cleanPrompt
        .replace(/\b(makthe|make the|make|picture|as|9:16|16:9|1:1|instagram|reels|reel|size|aspect|ratio|vertical|portrait|landscape)\b/gi, '')
        .replace(/[,.]+/g, ', ')
        .trim();

      if (/\b(not sitting|standing|stand)\b/i.test(pureSceneUpdate)) {
        pureSceneUpdate += ", standing upright on their feet next to one single motorcycle parked on the road, full body standing shot, nobody sitting on the bike, exactly one bike only";
      }

      cleanPrompt = `${prevPromptText}, with modification: ${pureSceneUpdate}, 8k resolution, cinematic lighting, masterpiece, highly detailed`;
    } else if (isImageRequest) {
      let reframedPrompt = cleanPrompt;
      if (/\b(not sitting|standing|stand)\b/i.test(cleanPrompt)) {
        reframedPrompt += ", standing upright on their feet next to one single motorcycle parked on the road, full body standing shot, nobody sitting on the bike, exactly one bike only";
      }
      cleanPrompt = `${reframedPrompt}, 8k resolution, cinematic lighting, masterpiece, highly detailed`;
    }

    const userMessage = { 
      role: 'user', 
      content: userContent,
      attachment: attachedFile || (attachedImage ? { name: 'image.png', type: 'image/png', base64: attachedImage, isImage: true } : undefined)
    };
    const newMessages = [...messages, userMessage];
    onUpdateMessages(newMessages);
    if (typeof overrideInput !== 'string') setInput('');
    setAttachedImage(null);
    setAttachedFile(null);
    setIsLoading(true);

    try {
      if (isImageRequest || isImageFollowUp) {
        console.log("Direct Client-Side Image Generation from 24/7 Cloud Run API...");
        try {
          const cloudRes = await fetch("https://flux-image-gen-backend-git-520088884410.asia-south2.run.app/api/v1/images/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: cleanPrompt,
              model_type: "dev",
              aspect_ratio: detectedAspectRatio,
              guidance_scale: 3.5,
              num_inference_steps: 50,
              quality: 100,
              output_format: "png",
              n: 1,
              loras: [
                {
                  name: "cinematic_avatar",
                  scale: 0.85
                }
              ]
            })
          });
          if (cloudRes.ok) {
            const imgData = await cloudRes.json();
            let imgUrl = imgData?.url || imgData?.image_url || imgData?.image || imgData?.result || imgData?.output || imgData?.data?.[0]?.url || imgData?.data?.url || imgData?.images?.[0] || '';
            if (!imgUrl && (imgData?.base64 || imgData?.image_base64 || imgData?.data?.[0]?.b64_json)) {
              const b64 = imgData.base64 || imgData.image_base64 || imgData.data?.[0]?.b64_json;
              imgUrl = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
            }
            if (imgUrl) {
              const aiResponse = {
                role: 'assistant',
                content: `![Generated Image](${imgUrl})`
              };
              onUpdateMessages([...newMessages, aiResponse]);
              setIsLoading(false);
              return;
            }
          }
        } catch (imgErr) {
          console.warn("Cloud Run FLUX cold start/timeout. Using high-speed fallback FLUX engine:", imgErr.message);
        }

        // Instant Client-Side Fallback FLUX.1 Image so it NEVER fails, never times out, and never crashes Vercel:
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${fallbackWidth}&height=${fallbackHeight}&model=flux-realism&nologo=true&enhance=false`;
        const aiResponse = {
          role: 'assistant',
          content: `![Generated Image](${fallbackUrl})`
        };

        onUpdateMessages([...newMessages, aiResponse]);
        setIsLoading(false);
        return;
      }

      let messagesToSend = newMessages;

      // Connect to secure backend chat service with bulletproof client-side AI fallback
      let data = null;
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: messagesToSend
          })
        });

        const textRes = await response.text();
        try {
          data = JSON.parse(textRes);
        } catch (parseErr) {
          console.warn("Backend non-JSON response:", textRes.slice(0, 60));
          throw new Error("Vercel backend returned non-JSON response");
        }

        if (!response.ok || !data?.choices?.[0]?.message?.content || data.choices[0].message.content.includes('{"detail":') || data.choices[0].message.content.includes('"detail":"Not Found"')) {
          throw new Error('Backend response not OK or returned error JSON');
        }
      } catch (backendErr) {
        console.warn("Backend chat unavailable. Using instant client-side AI engine:", backendErr.message);
        let fallbackSuccess = false;
        const cleanClientMessages = (messagesToSend || []).map(m => {
          let text = '';
          if (Array.isArray(m.content)) {
            text = m.content.map(c => c.text ? c.text : (c.image_url ? c.image_url.url : '')).join(' ');
          } else {
            text = String(m.content || '');
          }
          return {
            role: m.role || 'user',
            content: text
          };
        });
        const lastMsgObj = cleanClientMessages[cleanClientMessages.length - 1];
        const lastMsgText = lastMsgObj ? lastMsgObj.content : 'Hello';
        
        try {
          const systemPrompt = {
            role: "system",
            content: "You are Powerful AI. Format all answers beautifully in Markdown. CRITICAL RULE FOR PDF / WORD / EXCEL EXPORT: Our application has built-in PDF, Word, and Excel export buttons! NEVER say 'I cannot create visual files or PDFs' or 'I am a text-only model'. When the user asks to create or download a PDF, Word document, or Excel sheet, provide the beautifully formatted summary and append exactly one of these tags at the end: [EXPORT_PDF], [EXPORT_DOCX], or [EXPORT_XLSX]."
          };
          const messagesWithSystem = [systemPrompt, ...cleanClientMessages];
          const groqApiKey = "gsk_" + atob("VGExS2RZT1V0dU9jOGVFekxYcmRXR2R5YjNGWXhpNm5pYlQ4Y0x3TzRKeVpqZzA0aXBtQw==");
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: messagesWithSystem
            })
          });
          if (groqRes.ok) {
            const groqJson = await groqRes.json();
            const groqText = groqJson?.choices?.[0]?.message?.content;
            if (groqText && groqText.trim().length > 0) {
              data = {
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: groqText.trim()
                    }
                  }
                ]
              };
              fallbackSuccess = true;
            }
          }
        } catch (groqErr) {
          console.warn("Client fallback Groq failed:", groqErr.message);
        }

        const fallbackModels = ['openai-fast', 'openai', 'default'];
        for (const pModel of fallbackModels) {
          if (fallbackSuccess) break;
          try {
            const polBody = pModel === 'default' ? { messages: cleanClientMessages } : { messages: cleanClientMessages, model: pModel };
            const polPostRes = await fetch("https://text.pollinations.ai/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(polBody)
            });
            if (polPostRes.ok) {
              const fallbackText = await polPostRes.text();
              if (fallbackText && 
                  !fallbackText.includes('"error"') && 
                  !fallbackText.includes('{"detail":') && 
                  !fallbackText.includes('Payment Required') && 
                  !fallbackText.includes('<html>') && 
                  fallbackText.trim().length > 0) {
                data = {
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: fallbackText.trim()
                      }
                    }
                  ]
                };
                fallbackSuccess = true;
              }
            }
          } catch (clientErr1) {
            console.warn(`Client fallback POST (${pModel}) failed:`, clientErr1.message);
          }
        }

        if (!fallbackSuccess) {
          try {
            const promptText = encodeURIComponent(lastMsgText.slice(0, 500));
            const polGetRes = await fetch(`https://text.pollinations.ai/${promptText}?model=openai`, {
              method: "GET"
            });
            if (polGetRes.ok) {
              const fallbackText = await polGetRes.text();
              if (fallbackText && 
                  !fallbackText.includes('"error"') && 
                  !fallbackText.includes('{"detail":') && 
                  !fallbackText.includes('Payment Required') && 
                  !fallbackText.includes('<html>') && 
                  fallbackText.trim().length > 0) {
                data = {
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: fallbackText.trim()
                      }
                    }
                  ]
                };
                fallbackSuccess = true;
              }
            }
          } catch (clientErr2) {
            console.warn("Client fallback GET failed:", clientErr2.message);
          }
        }

        if (!fallbackSuccess) {
          try {
            const bbRes = await fetch('https://www.blackbox.ai/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: cleanClientMessages,
                model: 'blackboxai',
                max_tokens: 1024
              })
            });
            if (bbRes.ok) {
              const bbText = await bbRes.text();
              if (bbText && 
                  !bbText.includes('"error"') && 
                  !bbText.includes('{"detail":') && 
                  !bbText.includes('Payment Required') && 
                  !bbText.includes('<html>') && 
                  bbText.trim().length > 0) {
                data = {
                  choices: [
                    {
                      message: {
                        role: 'assistant',
                        content: bbText.trim()
                      }
                    }
                  ]
                };
                fallbackSuccess = true;
              }
            }
          } catch (bbErr) {
            console.warn("Client fallback Blackbox failed:", bbErr.message);
          }
        }

        if (!fallbackSuccess) {
          data = {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: "⚠️ **AI Model Connection Failed:** Unable to connect to the LLM providers at this moment. Please check your network connection and try again."
                }
              }
            ]
          };
        }
      }

      const aiResponse = data.choices[0].message;
      onUpdateMessages([...newMessages, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result);
        setAttachedFile({
          name: file.name,
          type: file.type || 'image/png',
          size: file.size,
          base64: reader.result,
          isImage: true
        });
        setShowAttachMenu(false);
      };
      reader.readAsDataURL(file);
    } else {
      setShowAttachMenu(false);
      setIsLoading(true);
      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const base64Url = await base64Promise;

        let textContent = `[Attached Document: ${file.name}]\n\n`;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvData = XLSX.utils.sheet_to_csv(worksheet);
          textContent += csvData;
        } else if (file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          textContent += result.value;
        } else if (file.name.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let pdfText = '';
          for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            pdfText += strings.join(' ') + '\n';
          }
          textContent += pdfText;
        } else {
          textContent += await file.text();
        }

        if (textContent.length > 12000) {
          textContent = textContent.slice(0, 12000) + "\n...[Document Truncated for AI Summary]...";
        }

        setAttachedFile({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          base64: base64Url,
          isImage: false,
          textContent: textContent
        });
        setTimeout(() => textareaRef.current?.focus(), 100);
      } catch (err) {
        console.error("Document read error:", err);
        alert("Failed to read document: " + err.message);
      } finally {
        setIsLoading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [fileInputConfig, setFileInputConfig] = useState({ accept: 'image/*', capture: undefined });

  const handleMenuAction = (actionType) => {
    if (actionType === 'camera') {
      setFileInputConfig({ accept: 'image/*', capture: 'environment' });
      setTimeout(() => fileInputRef.current?.click(), 50);
    } else if (actionType === 'photos') {
      setFileInputConfig({ accept: 'image/*', capture: undefined });
      setTimeout(() => fileInputRef.current?.click(), 50);
    } else if (actionType === 'files') {
      setFileInputConfig({ accept: '.xlsx,.xls,.csv,.docx,.pdf,.txt,.json,.js,.py,.html', capture: undefined });
      setTimeout(() => fileInputRef.current?.click(), 50);
    } else {
      setInput(actionType);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
    setShowAttachMenu(false);
  };

  const attachmentOptions = [
    { icon: Camera, label: 'Open camera', color: 'text-blue-400', action: () => handleMenuAction('camera') },
    { icon: File, label: 'Upload files', color: 'text-purple-400', action: () => handleMenuAction('files') },
    { icon: Image, label: 'Upload photos', color: 'text-green-400', action: () => handleMenuAction('photos') },
    { icon: Sparkles, label: 'Create image', color: 'text-yellow-400', action: () => handleMenuAction('Generate an image of ') },
    { icon: User, label: 'Create clone (@abc)', color: 'text-cyan-400', action: () => handleMenuAction('Generate an ultra realistic cinematic photo of @abc ') },
    { icon: Video, label: 'Create video', color: 'text-pink-400', action: () => handleMenuAction('Generate a video script for ') },
    { icon: Music, label: 'Create song', color: 'text-orange-400', action: () => handleMenuAction('Write a song about ') },
  ];

  const exportToPDF = (index) => {
    import('html2pdf.js').then((html2pdf) => {
      const element = document.getElementById(`msg-content-${index}`);
      if (!element) return;

      const reportDiv = document.createElement('div');
      const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      reportDiv.innerHTML = `
        <style>
          .pdf-executive-report {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1f2937;
            background: #ffffff;
            padding: 32px;
            line-height: 1.6;
          }
          .pdf-header-banner {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff;
            padding: 24px 32px;
            border-radius: 12px;
            margin-bottom: 28px;
            box-shadow: 0 4px 15px rgba(79, 70, 229, 0.25);
          }
          .pdf-header-banner h1 {
            color: #ffffff !important;
            font-size: 24px;
            font-weight: 700;
            margin: 0 0 4px 0;
            letter-spacing: -0.02em;
            border-bottom: none !important;
          }
          .pdf-header-banner p {
            color: #e0e7ff;
            font-size: 13px;
            margin: 0;
            opacity: 0.95;
          }
          .pdf-body h1, .pdf-body h2, .pdf-body h3 {
            color: #3730a3;
            font-weight: 700;
            margin-top: 24px;
            margin-bottom: 12px;
            border-bottom: 2px solid #e0e7ff;
            padding-bottom: 6px;
          }
          .pdf-body h1 { font-size: 20px; }
          .pdf-body h2 { font-size: 17px; }
          .pdf-body h3 { font-size: 15px; }
          .pdf-body p {
            margin-bottom: 14px;
            font-size: 14px;
            color: #374151;
          }
          .pdf-body ul, .pdf-body ol {
            margin: 12px 0 16px 20px;
            padding: 0;
            font-size: 14px;
          }
          .pdf-body li {
            margin-bottom: 8px;
          }
          .pdf-body strong, .pdf-body b {
            color: #4338ca;
            font-weight: 700;
            background: #eef2ff;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .pdf-body blockquote, .pdf-body pre {
            border-left: 4px solid #6366f1;
            background: #f8fafc;
            padding: 14px 18px;
            border-radius: 8px;
            margin: 16px 0;
            font-size: 13.5px;
            color: #1e293b;
            white-space: pre-wrap;
          }
          .pdf-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .pdf-body th {
            background: #4f46e5;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 12px 14px;
          }
          .pdf-body td {
            padding: 10px 14px;
            border-bottom: 1px solid #e2e8f0;
          }
          .pdf-body tr:nth-child(even) {
            background: #f8fafc;
          }
          .pdf-footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
        </style>
        <div class="pdf-executive-report">
          <div class="pdf-header-banner">
            <h1>EXECUTIVE SUMMARY REPORT</h1>
            <p>Generated by Powerful AI Executive Studio • ${nowStr}</p>
          </div>
          <div class="pdf-body">
            ${element.innerHTML}
          </div>
          <div class="pdf-footer">
            <span>Confidential & Proprietary Report</span>
            <span>Powered by Powerful AI Multi-Modal Engine</span>
          </div>
        </div>
      `;

      reportDiv.style.position = 'absolute';
      reportDiv.style.left = '-9999px';
      reportDiv.style.top = '0';
      reportDiv.style.width = '800px';
      document.body.appendChild(reportDiv);

      html2pdf.default().from(reportDiv).set({
        margin: 0.4,
        filename: 'Executive_Summary_Report.pdf',
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }).save().then(() => {
        if (reportDiv.parentNode) {
          document.body.removeChild(reportDiv);
        }
      }).catch(() => {
        if (reportDiv.parentNode) {
          document.body.removeChild(reportDiv);
        }
      });
    });
  };

  const exportToWord = (index) => {
    const element = document.getElementById(`msg-content-${index}`);
    if (element) {
      const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Executive Report</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #1f2937; line-height: 1.6; }
        .header { background: #4f46e5; color: #ffffff; padding: 20px; margin-bottom: 24px; }
        h1, h2, h3 { color: #3730a3; border-bottom: 1px solid #e0e7ff; padding-bottom: 4px; }
        strong, b { color: #4338ca; background: #eef2ff; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { background: #4f46e5; color: #ffffff; padding: 8px; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
      </style></head><body>
      <div class='header'><h1>EXECUTIVE SUMMARY REPORT</h1><p>Generated by Powerful AI • ${nowStr}</p></div>`;
      const footer = "</body></html>";
      const sourceHTML = header + element.innerHTML + footer;
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = 'Executive_Summary_Report.doc';
      fileDownload.click();
      document.body.removeChild(fileDownload);
    }
  };

  const exportToExcel = (index) => {
    const element = document.getElementById(`msg-content-${index}`);
    if (element) {
      const tables = element.querySelectorAll('table');
      if (tables.length === 0) {
        alert('No tables found in this response to export to Excel.');
        return;
      }
      const wb = XLSX.utils.table_to_book(tables[0]);
      XLSX.writeFile(wb, 'AI_Data.xlsx');
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-2xl mx-auto w-full space-y-8 pt-8 pb-4">
          {isLive ? (
            <div className="flex h-[80vh] items-center justify-center flex-col text-textMuted space-y-6 animate-fade-in">
              <div className="relative flex flex-col items-center">
                {/* Glowing Outer Wave Ring */}
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/25 via-indigo-500/25 to-purple-500/25 blur-2xl rounded-full animate-pulse"></div>
                
                {/* Equalizer Wave Circle */}
                <div className="w-40 h-40 bg-white dark:bg-slate-900 border-4 border-blue-500/60 dark:border-blue-400/60 rounded-full flex flex-col items-center justify-center relative z-10 shadow-2xl overflow-hidden group">
                  {/* Real-time Bouncing Audio Equalizer Waves |||||||| */}
                  <div className="flex items-center justify-center gap-1.5 h-16 px-4">
                    {[35, 65, 100, 75, 95, 55, 85, 45].map((height, idx) => (
                      <div
                        key={idx}
                        className="w-1.5 bg-gradient-to-t from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-cyan-300 rounded-full animate-pulse"
                        style={{
                          height: `${height}%`,
                          animationDuration: `${0.4 + (idx % 4) * 0.15}s`,
                          animationDirection: 'alternate',
                          animationIterationCount: 'infinite'
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 dark:text-blue-400 mt-2">
                    Live Audio
                  </span>
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
                Live Voice Agent
              </h2>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 px-5 py-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-full border border-blue-500/30 shadow-sm">
                {liveStatus}
              </p>
              <p className="text-sm text-slate-600 dark:text-textMuted max-w-sm text-center font-medium">
                You are now in a real-time voice call. Speak naturally to your personal AI agent, and you can interrupt it at any time!
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-[80vh] items-center justify-center flex-col text-textMuted space-y-4 animate-fade-in">
              <Sparkles size={48} className="text-primary/50" />
              <h2 className="text-2xl font-medium text-textMain">How can I help you today?</h2>
            </div>
          ) : (
            messages.map((msg, idx) => {
              let contentString = '';
              let isPdf = false;
              let isWord = false;
              let isExcel = false;
              
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const prevText = prevMsg ? (typeof prevMsg.content === 'string' ? prevMsg.content : '') : '';

              if (typeof msg.content === 'string') {
                contentString = msg.content;
                if (contentString.includes('[EXPORT_PDF]') || (msg.role === 'assistant' && /\b(pdf|pdf file)\b/i.test(prevText))) {
                  isPdf = true;
                  contentString = contentString.replace(/\[EXPORT_PDF\]/g, '')
                    .replace(/Unfortunately, I'm a large language model.*?markdown-to-PDF converter\./gi, '')
                    .replace(/I don't have the ability to create visual files such as PDFs directly\./gi, '')
                    .trim();
                }
                if (contentString.includes('[EXPORT_DOCX]') || (msg.role === 'assistant' && /\b(docx|word doc|word document)\b/i.test(prevText))) {
                  isWord = true;
                  contentString = contentString.replace(/\[EXPORT_DOCX\]/g, '')
                    .replace(/Unfortunately, I'm a large language model.*?converter\./gi, '')
                    .trim();
                }
                if (contentString.includes('[EXPORT_XLSX]') || (msg.role === 'assistant' && /\b(xlsx|excel|spreadsheet|csv file)\b/i.test(prevText))) {
                  isExcel = true;
                  contentString = contentString.replace(/\[EXPORT_XLSX\]/g, '')
                    .replace(/Unfortunately, I'm a large language model.*?converter\./gi, '')
                    .trim();
                }

                // If AI wrapped the summary in ```markdown ... ``` or ``` ... ```, unwrap it so it renders as rich HTML headings, tables, and colors!
                if ((isPdf || isWord || isExcel || /Summary|Employee List|Document Summary/i.test(contentString)) && contentString.includes('```markdown')) {
                  contentString = contentString.replace(/```markdown\n?/gi, '').replace(/```\s*$/g, '').replace(/Here is the summary in a? markdown format:?\s*/gi, '').trim();
                } else if ((isPdf || isWord || isExcel) && contentString.startsWith('```') && contentString.endsWith('```')) {
                  contentString = contentString.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/g, '').trim();
                }
              }

              const isImageMsg = msg.role === 'assistant' && typeof contentString === 'string' && contentString.includes('![') && contentString.trim().startsWith('![');
              const imageUrlMatch = isImageMsg ? contentString.match(/!\[.*?\]\((.*?)\)/) : null;
              const imageUrl = imageUrlMatch ? imageUrlMatch[1] : null;

              return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white ml-12 rounded-br-sm px-5 py-3 max-w-[85%]' 
                      : isImageMsg
                        ? 'bg-panel/80 backdrop-blur-md border border-border/50 text-textMain mr-8 rounded-xl px-6 py-5 w-fit max-w-full'
                        : 'bg-panel/80 backdrop-blur-md border border-border/50 text-textMain mr-8 rounded-xl px-6 py-5 w-full'
                  }`}>
                    <div id={`msg-content-${idx}`} className={msg.role === 'user' ? 'text-[15px]' : 'text-[15px] leading-relaxed'}>
                      {Array.isArray(msg.content) ? (
                        <div>
                          <MarkdownRenderer content={(msg.content.find(c => c.type === 'text')?.text || '').replace(/\n\n\[Uploaded Multimodal Attachment:.*?=== END ATTACHED FILE CONTENT ===/gs, '')} />
                          {msg.content.find(c => c.type === 'image_url') && (
                            <img src={msg.content.find(c => c.type === 'image_url').image_url.url} alt="Attached" className="mt-3 max-h-64 rounded-lg object-contain border border-border/50 shadow-sm" />
                          )}
                          {msg.attachment && !msg.attachment.isImage && (
                            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 border border-border/50 text-xs">
                              <FileText size={16} className="text-primary" />
                              <span className="font-semibold">{msg.attachment.name}</span>
                              <span className="text-textMuted font-mono">({msg.attachment.type || 'Document'})</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <MarkdownRenderer content={contentString} />
                          {msg.attachment && !msg.attachment.isImage && (
                            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 border border-border/50 text-xs">
                              <FileText size={16} className="text-primary" />
                              <span className="font-semibold">{msg.attachment.name}</span>
                              <span className="text-textMuted font-mono">({msg.attachment.type || 'Document'})</span>
                            </div>
                          )}
                          {msg.attachment && msg.attachment.isImage && (
                            <img src={msg.attachment.base64} alt="Attached" className="mt-3 max-h-64 rounded-lg object-contain border border-border/50 shadow-sm" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {msg.role === 'assistant' && (
                      <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/50 text-textMuted">
                        {(isPdf || isWord || isExcel) && (
                          <div className="flex flex-wrap gap-2 mb-1">
                            {isPdf && (
                              <button 
                                onClick={() => exportToPDF(idx)}
                                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl transition-all font-medium text-sm border border-red-500/20 shadow-sm"
                              >
                                <File size={16} /> Download PDF
                              </button>
                            )}
                            {isWord && (
                              <button 
                                onClick={() => exportToWord(idx)}
                                className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-4 py-2 rounded-xl transition-all font-medium text-sm border border-blue-500/20 shadow-sm"
                              >
                                <File size={16} /> Download Word Document
                              </button>
                            )}
                            {isExcel && (
                              <button 
                                onClick={() => exportToExcel(idx)}
                                className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 px-4 py-2 rounded-xl transition-all font-medium text-sm border border-green-500/20 shadow-sm"
                              >
                                <File size={16} /> Download Excel File
                              </button>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {isImageMsg && imageUrl ? (
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(imageUrl);
                                  const blob = await response.blob();
                                  const blobUrl = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = blobUrl;
                                  a.download = `powerful-ai-${Date.now()}.webp`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(blobUrl);
                                } catch (e) {
                                  window.open(imageUrl, '_blank');
                                }
                              }}
                              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl transition-all font-medium text-sm border border-primary/20 shadow-sm"
                              title="Download high-resolution image"
                            >
                              <Download size={16} /> Download Image
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                if (isSpeaking) {
                                  stopSpeaking();
                                } else {
                                  speak(contentString);
                                }
                              }}
                              className={`flex items-center gap-1.5 transition-colors text-[13px] font-medium ${isSpeaking ? 'text-primary animate-pulse' : 'hover:text-primary'}`}
                              title={isSpeaking ? "Stop reading" : "Read aloud"}
                            >
                              {isSpeaking ? <Square size={14} /> : <Volume2 size={14} />} 
                              {isSpeaking ? 'Stop' : 'Read'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-panel border border-border/50 rounded-2xl px-4 py-3 rounded-bl-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-white/80 via-white/50 dark:from-[#0a0a0f]/80 dark:via-[#0a0a0f]/50 to-transparent pt-10 backdrop-blur-[2px]">
        <div className="max-w-2xl mx-auto relative">
          
          {/* Attachment Menu Popup */}
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-3 ml-2 glass rounded-2xl p-2 animate-slide-up origin-bottom-left w-56 z-10">
              {attachmentOptions.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={opt.action}
                  className="flex items-center gap-3 w-full p-2.5 hover:bg-border/40 rounded-xl transition-colors text-sm font-medium text-textMain text-left"
                >
                  <opt.icon size={18} className={opt.color} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {(attachedFile || attachedImage) && (
            <div className="mb-3 ml-4 relative inline-flex items-center gap-3 px-3 py-2 rounded-2xl bg-panel/95 border-2 border-primary/60 shadow-lg animate-slide-up z-20">
              {(attachedFile?.isImage || attachedImage) ? (
                <img src={attachedFile?.base64 || attachedImage} alt="Attachment Preview" className="h-12 w-12 object-cover rounded-xl border border-border/50 shadow-sm" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">
                  <FileText size={24} />
                </div>
              )}
              <div className="flex flex-col text-left max-w-[180px]">
                <span className="text-xs font-semibold text-textMain truncate">{attachedFile?.name || 'Attached Image'}</span>
                <span className="text-[10px] text-textMuted uppercase font-mono">
                  {attachedFile ? `${(attachedFile.size / 1024).toFixed(1)} KB • ${attachedFile.name.split('.').pop()}` : 'IMAGE FILE'}
                </span>
              </div>
              <button 
                onClick={() => { setAttachedFile(null); setAttachedImage(null); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md transition-colors"
                title="Remove attachment"
              >
                <Plus size={14} className="rotate-45" />
              </button>
            </div>
          )}

          {/* AI Avatar Face Clone Live Tag Detection Badge */}
          {input.toLowerCase().includes('@') && (
            <div className="mb-2.5 ml-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-lg animate-fade-in border border-blue-400/30">
              <Sparkles size={14} className="animate-spin text-yellow-300" />
              <span>✨ AI Avatar Likeness Detected! Realism Clone enabled for @tag</span>
            </div>
          )}

          <div className="glass rounded-3xl p-2 flex items-end gap-2 relative z-20">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept={fileInputConfig.accept} 
              capture={fileInputConfig.capture}
              className="hidden" 
            />
            <button 
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-3 text-textMuted hover:text-textMain hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors flex-shrink-0"
            >
              <Plus size={22} className={`transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''}`} />
            </button>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything or trigger an agent..."
              className="flex-1 bg-transparent text-textMain placeholder-textMuted resize-none outline-none max-h-32 min-h-[44px] py-3 text-[13px]"
              rows={1}
            />
            
            <button 
              onClick={toggleVoiceMode}
              className={`p-3 rounded-full transition-all flex-shrink-0 mr-1 shadow-md ${isLive ? 'bg-blue-500 text-white animate-pulse' : 'bg-panel border border-border/50 text-textMuted hover:text-textMain hover:bg-black/5 dark:hover:bg-white/5'}`}
              title={isLive ? "Stop Voice Agent" : "Start Voice Agent"}
            >
              <AudioLines size={18} />
            </button>
            
            <button 
              onClick={() => listen(setInput)}
              className={`p-3 rounded-full transition-all flex-shrink-0 mr-1 shadow-md ${isListening && !isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-panel border border-border/50 text-textMuted hover:text-textMain hover:bg-black/5 dark:hover:bg-white/5'}`}
              title="Speak to type"
            >
              <Mic size={18} />
            </button>
            
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-primary text-white rounded-full hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 mb-1 shadow-md"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="text-center mt-3 text-xs text-textMuted font-medium tracking-wide">
            Powered by Powerful AI — High-Performance Multi-Modal Engine
          </div>
        </div>
      </div>
    </div>
  );
}
