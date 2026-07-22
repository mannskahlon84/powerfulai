import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Camera, File, Image, Video, Music, Sparkles, Mic, Volume2, Square } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
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
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { speak, stopSpeaking, isSpeaking, listen, isListening } = useSpeech();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return;

    let userContent = input.trim() || "What is in this image?";
    if (attachedImage) {
      userContent = [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: attachedImage } }
      ];
    }

    const userMessage = { role: 'user', content: userContent };
    const newMessages = [...messages, userMessage];
    onUpdateMessages(newMessages);
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      // Connect to secure Vercel serverless function
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data && data.choices) {
          const aiResponse = data.choices[0].message;
          onUpdateMessages([...newMessages, aiResponse]);
          return;
        }
        throw new Error('Network response was not ok');
      }

      const aiResponse = data.choices[0].message;
      onUpdateMessages([...newMessages, aiResponse]);
    } catch (error) {
      console.error('Error fetching response:', error);
      onUpdateMessages([...newMessages, { role: 'assistant', content: `🚨 **Backend Connection Error:**\n\n${error.message}\n\n*If this says "Failed to fetch", you are probably on the wrong port (make sure URL is localhost:8888, not 5173). If it says "Unexpected token", the Netlify server crashed.*` }]);
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
        setShowAttachMenu(false);
      };
      reader.readAsDataURL(file);
    } else {
      setShowAttachMenu(false);
      setIsLoading(true);
      try {
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
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          textContent += await file.text();
        } else {
          throw new Error("Unsupported file format. Please upload Images, Excel, Word, or PDF.");
        }
        
        setInput(textContent.substring(0, 20000));
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
      setFileInputConfig({ accept: '.xlsx,.docx,.pdf,.txt', capture: undefined });
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
    { icon: Video, label: 'Create video', color: 'text-pink-400', action: () => handleMenuAction('Generate a video script for ') },
    { icon: Music, label: 'Create song', color: 'text-orange-400', action: () => handleMenuAction('Write a song about ') },
  ];

  const exportToPDF = (index) => {
    import('html2pdf.js').then((html2pdf) => {
      const element = document.getElementById(`msg-content-${index}`);
      if (element) {
        html2pdf.default().from(element).set({
          margin: 1,
          filename: 'AI_Summary.pdf',
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).save();
      }
    });
  };

  const exportToWord = (index) => {
    const element = document.getElementById(`msg-content-${index}`);
    if (element) {
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word Document</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + element.innerHTML + footer;
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = 'AI_Summary.doc';
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
        <div className="max-w-3xl mx-auto w-full space-y-6 pt-8 pb-4">
          {messages.length === 0 ? (
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
              
              if (typeof msg.content === 'string') {
                contentString = msg.content;
                if (contentString.includes('[EXPORT_PDF]')) {
                  isPdf = true;
                  contentString = contentString.replace('[EXPORT_PDF]', '').trim();
                }
                if (contentString.includes('[EXPORT_DOCX]')) {
                  isWord = true;
                  contentString = contentString.replace('[EXPORT_DOCX]', '').trim();
                }
                if (contentString.includes('[EXPORT_XLSX]')) {
                  isExcel = true;
                  contentString = contentString.replace('[EXPORT_XLSX]', '').trim();
                }
              }

              return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white ml-12 rounded-br-sm' 
                      : 'bg-panel border border-border/50 text-textMain mr-12 rounded-bl-sm'
                  }`}>
                    <div id={`msg-content-${idx}`}>
                      {Array.isArray(msg.content) ? (
                        <div>
                          <MarkdownRenderer content={msg.content.find(c => c.type === 'text')?.text || ''} />
                          {msg.content.find(c => c.type === 'image_url') && (
                            <img src={msg.content.find(c => c.type === 'image_url').image_url.url} alt="Attached" className="mt-3 max-h-64 rounded-lg object-contain" />
                          )}
                        </div>
                      ) : (
                        <MarkdownRenderer content={contentString} />
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
        <div className="max-w-3xl mx-auto relative">
          
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

          {attachedImage && (
            <div className="mb-3 ml-4 relative inline-block animate-slide-up">
              <img src={attachedImage} alt="Attachment" className="h-16 w-16 object-cover rounded-xl border-2 border-primary/50 shadow-md" />
              <button 
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm transition-colors"
              >
                <Plus size={14} className="rotate-45" />
              </button>
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
              onClick={() => listen(setInput)}
              className={`p-3 rounded-full transition-all flex-shrink-0 mr-1 shadow-md ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-panel border border-border/50 text-textMuted hover:text-textMain hover:bg-black/5 dark:hover:bg-white/5'}`}
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
            Powered by local LiteLLM proxy
          </div>
        </div>
      </div>
    </div>
  );
}
