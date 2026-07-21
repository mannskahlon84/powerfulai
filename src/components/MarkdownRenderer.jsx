import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

export default function MarkdownRenderer({ content }) {
  // Pre-process content to fix broken markdown images where the AI forgot to URL-encode spaces
  let processedContent = content || '';
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  processedContent = processedContent.replace(mdImageRegex, (match, alt, url) => {
    // If the URL contains spaces, ReactMarkdown will break it. Encode the URL completely.
    if (url.includes(' ')) {
      return `![${alt}](${encodeURI(url.trim())})`;
    }
    return match;
  });

  return (
    <div className="markdown-body text-[13px] md:text-sm leading-normal space-y-2 text-textMain">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style paragraphs
          p({ node, children }) {
            return <p className="mb-4 last:mb-0">{children}</p>;
          },
          // Style links
          a({ node, children, href }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                {children}
              </a>
            );
          },
          // Style lists
          ul({ node, children }) {
            return <ul className="list-disc pl-6 mb-4 space-y-1 marker:text-primary/70">{children}</ul>;
          },
          ol({ node, children }) {
            return <ol className="list-decimal pl-6 mb-4 space-y-1 marker:text-primary/70">{children}</ol>;
          },
          // Style headings
          h1({ node, children }) {
            return <h1 className="text-2xl font-bold mt-5 mb-3 text-textMain">{children}</h1>;
          },
          h2({ node, children }) {
            return <h2 className="text-xl font-bold mt-4 mb-2 text-textMain/90">{children}</h2>;
          },
          h3({ node, children }) {
            return <h3 className="text-lg font-bold mt-3 mb-1 text-textMain/80">{children}</h3>;
          },
          // Style bold text
          strong({ node, children }) {
            return <strong className="font-bold text-textMain">{children}</strong>;
          },
          // Style images
          img({ node, src, alt }) {
            return (
              <img 
                src={src} 
                alt={alt} 
                className="rounded-xl shadow-lg border border-border/30 max-w-full my-4 object-cover max-h-[500px]"
                loading="lazy"
              />
            );
          },
          // Style code blocks
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const [copied, setCopied] = useState(false);

            const handleCopy = () => {
              navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            };

            if (!inline && match) {
              return (
                <div className="relative group rounded-xl overflow-hidden my-4 border border-border/30 bg-[#1d1f21]">
                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-border/30 text-xs text-textMuted">
                    <span className="font-mono uppercase tracking-wider">{match[1]}</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    {...props}
                    style={atomDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'transparent',
                      fontSize: '0.875rem',
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              );
            }
            // Inline code
            return (
              <code {...props} className="bg-primary/20 text-primary-light px-1.5 py-0.5 rounded-md font-mono text-sm">
                {children}
              </code>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
