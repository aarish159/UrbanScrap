import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  RotateCcw,
  Sparkles,
  ExternalLink,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  type ChatMessage,
  detectLanguage,
  sendChatMessage,
} from '../../utils/aiSupport';

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    '**Namaste & Welcome to UrbanScrap!** 🌱\n\nI am your instant support assistant. I can help you with:\n• **Indicative Scrap Rates** (Paper, Plastic, Metal, E-waste)\n• **Doorstep Pickups** & Slot Booking guidance\n• **Order Status Tracking** for your pickups\n• **Dealer Onboarding** & GST verification rules\n\nFeel free to ask in **English** or **Hinglish**! How may I assist you today?',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const SUGGESTED_PROMPTS = [
  { label: 'Today\'s Scrap Rates 📰', query: 'What are the scrap rates for newspaper, metals, and plastic?' },
  { label: 'How to Book Pickup 🚚', query: 'How does doorstep pickup work and how do I schedule it?' },
  { label: 'Check My Bookings 📦', query: 'Can you check my booking status?' },
  { label: 'Loha & Copper Rate ⚡', query: 'Loha, copper aur aluminium ka rate kitna hai?' },
  { label: 'Dealer Verification 🏢', query: 'How does dealer GST verification and admin approval work?' },
];

export const SupportChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetupNotice, setShowSetupNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  const handleResetConversation = () => {
    setMessages([
      {
        ...INITIAL_WELCOME,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setError(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setError(null);
    setInputValue('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const language = detectLanguage(text);
      const apiMessages = newHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await sendChatMessage(apiMessages, user, language);

      if (response.setupRequired) {
        setShowSetupNotice(true);
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: response.isFallback,
        actionButton: response.actionButton,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError('Unable to fetch response right now. Please check your internet connection or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionButtonClick = (action: ChatMessage['actionButton']) => {
    if (!action) return;

    if (action.actionType === 'open_auth') {
      openAuthModal({ returnTo: action.url || '/bookings' });
    } else if (action.actionType === 'navigate' && action.url) {
      navigate(action.url);
      // On mobile screen sizes, close panel on navigation so user can see destination
      if (window.innerWidth < 640) {
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          id="ask-urbanscrap-chat-btn"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#091610]/95 hover:bg-[#0e2219] backdrop-blur-xl text-white rounded-full shadow-2xl shadow-emerald-950/60 hover:shadow-emerald-500/20 transition-all duration-300 transform hover:-translate-y-0.5 border border-emerald-500/30 group cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          aria-label="Open UrbanScrap AI Support Chat"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-[#07130c] font-bold shadow-inner">
            <Sparkles className="w-4 h-4 transition-transform group-hover:rotate-12" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-300 rounded-full border-2 border-[#091610] animate-pulse" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Instant Help
            </span>
            <span className="block text-sm font-bold text-white">Ask UrbanScrap</span>
          </div>
        </button>
      )}

      {/* Responsive Chat Panel */}
      {isOpen && (
        <div
          id="urbanscrap-chat-panel"
          className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-50 sm:w-[420px] h-[600px] max-h-[88vh] bg-[#091610]/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/80 border border-white/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 text-white"
          role="dialog"
          aria-modal="true"
          aria-label="UrbanScrap AI Support Chat Panel"
        >
          {/* Header */}
          <div className="bg-[#07130c]/90 border-b border-white/10 text-white p-4 flex items-center justify-between shadow-sm relative">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 backdrop-blur-sm text-emerald-400">
                <Sparkles className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#091610]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight text-white">UrbanScrap Assistant</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium px-1.5 py-0.5 rounded-full">
                    AI Support
                  </span>
                </div>
                <p className="text-xs text-[#9cb1a4]">Scrap Rates • Bookings • Inquiries</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetConversation}
                className="p-1.5 text-[#9cb1a4] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[#9cb1a4] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Setup / Informational Notice (if applicable) */}
          {showSetupNotice && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Knowledge Base Mode:</strong> Live scrap rates & database active.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupNotice(false)}
                className="text-amber-300 hover:underline text-[11px] font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-transparent text-sm">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-md text-sm leading-relaxed ${
                      isAssistant
                        ? 'bg-white/[0.04] text-[#f2f7f4] border border-white/10 rounded-tl-xs backdrop-blur-md'
                        : 'bg-emerald-600 text-white rounded-tr-xs shadow-emerald-950/40'
                    }`}
                  >
                    {/* Message Body with minimal formatting */}
                    <div className="whitespace-pre-line space-y-1.5">
                      {msg.content.split('\n').map((line, idx) => {
                        // Render bullet lists or headers cleanly
                        if (line.startsWith('• ') || line.startsWith('- ')) {
                          return (
                            <div key={idx} className="flex items-start gap-1.5 ml-1">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{parseMarkdown(line.slice(2))}</span>
                            </div>
                          );
                        }
                        if (line.match(/^\d+\.\s/)) {
                          const numMatch = line.match(/^(\d+\.)\s(.*)/);
                          if (numMatch) {
                            return (
                              <div key={idx} className="flex items-start gap-1.5 ml-1">
                                <span className="text-emerald-400 font-semibold">{numMatch[1]}</span>
                                <span>{parseMarkdown(numMatch[2])}</span>
                              </div>
                            );
                          }
                        }
                        return <div key={idx}>{parseMarkdown(line)}</div>;
                      })}
                    </div>

                    {/* Optional Action Button */}
                    {msg.actionButton && (
                      <div className="mt-3 pt-2.5 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => handleActionButtonClick(msg.actionButton)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          {msg.actionButton.actionType === 'open_auth' ? (
                            <LogIn className="w-3.5 h-3.5" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          <span>{msg.actionButton.label}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-emerald-100/50 mt-1 px-1">
                    {msg.timestamp}
                    {isAssistant && msg.isFallback && ' • Verified Catalog'}
                  </span>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl rounded-tl-xs px-4 py-3 shadow-sm flex items-center gap-2">
                  <div className="flex space-x-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs text-[#9cb1a4] ml-1">Checking UrbanScrap data...</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="font-semibold underline ml-2 cursor-pointer text-rose-200"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Suggested Prompts (shown only at start or after reset) */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                  Suggested Questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendMessage(prompt.query)}
                      className="text-xs bg-white/[0.04] hover:bg-emerald-500/20 text-[#f2f7f4] hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 px-2.5 py-1.5 rounded-full transition-colors cursor-pointer text-left"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Category Chips for easy questions */}
          <div className="px-3 py-1.5 bg-[#07130c]/70 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-[10px] font-semibold text-[#9cb1a4] uppercase shrink-0">Ask about:</span>
            <button
              type="button"
              onClick={() => handleSendMessage('What is the current newspaper raddi rate?')}
              className="shrink-0 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10 hover:border-emerald-400 text-white hover:text-emerald-300 transition-colors"
            >
              📰 Newspaper
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('What are iron and copper metal scrap rates?')}
              className="shrink-0 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10 hover:border-emerald-400 text-white hover:text-emerald-300 transition-colors"
            >
              🔩 Metals
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('How do I book a doorstep pickup for my scrap?')}
              className="shrink-0 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10 hover:border-emerald-400 text-white hover:text-emerald-300 transition-colors"
            >
              🚚 Pickup Steps
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('Check status of my bookings')}
              className="shrink-0 bg-white/[0.04] px-2 py-0.5 rounded border border-white/10 hover:border-emerald-400 text-white hover:text-emerald-300 transition-colors"
            >
              📦 My Orders
            </button>
          </div>

          {/* Footer Input */}
          <div className="p-3 bg-[#07130c]/90 border-t border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask in English or Hinglish..."
                disabled={isLoading}
                className="flex-1 text-sm px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl focus:bg-white/[0.07] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-emerald-100/30 text-white"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 text-[#07130c] disabled:text-white/30 font-bold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="mt-2 text-center">
              <span className="text-[10px] text-[#9cb1a4]">
                Rates are indicative. Final value confirmed after doorstep digital scale weighing.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Lightweight helper to render bold text (`**text**`) and italic text (`*text*`)
 * without requiring a heavy markdown runtime.
 */
function parseMarkdown(text: string): React.ReactNode {
  // If line contains bold **...**
  if (!text.includes('*')) {
    return text;
  }

  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-emerald-300">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic text-emerald-100/70">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
