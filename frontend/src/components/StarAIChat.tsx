import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { sendChatMessage } from '../services/api';
import { t } from '../i18n';

// SVG Star icon for StarAI
function StarIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" stroke="url(#starGrad)" strokeWidth="0.5" opacity="0.4" className="star-glow-ring" />
      <path
        d="M12 2L14.4 8.8L21.6 9.2L16 13.8L17.8 21L12 17.2L6.2 21L8 13.8L2.4 9.2L9.6 8.8L12 2Z"
        fill="url(#starFill)"
        stroke="rgba(180,220,255,0.5)"
        strokeWidth="0.5"
      />
      <circle cx="12" cy="11" r="2" fill="rgba(255,255,255,0.8)" />
      <defs>
        <linearGradient id="starFill" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#6ab4ff" />
          <stop offset="50%" stopColor="#3389ff" />
          <stop offset="100%" stopColor="#1a5cd0" />
        </linearGradient>
        <linearGradient id="starGrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#88ccff" />
          <stop offset="100%" stopColor="#3389ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function StarAIChat() {
  const {
    lang,
    chatOpen, setChatOpen,
    chatMessages, addChatMessage,
    chatLoading, setChatLoading,
    focusSatellite,
    setTimeSpeed,
    setShowOrbits,
    setShowLinks,
    highlightConstellation,
    setSatelliteCount,
    setCommRangeKm,
    setOrbitAltitudeKm,
    resetView,
  } = useStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const executeActions = (actions: any[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'focus_satellite':
          focusSatellite(action.norad_id);
          break;
        case 'set_time_speed':
          setTimeSpeed(action.speed);
          break;
        case 'toggle_orbits':
          setShowOrbits(action.visible);
          break;
        case 'toggle_links':
          setShowLinks(action.visible);
          break;
        case 'highlight_constellation':
          highlightConstellation(action.name);
          break;
        case 'set_satellite_count':
          setSatelliteCount(action.count);
          break;
        case 'set_comm_range':
          setCommRangeKm(action.range_km);
          break;
        case 'set_orbit_altitude':
          setOrbitAltitudeKm(action.altitude_km);
          break;
        case 'reset_view':
          resetView();
          break;
      }
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || chatLoading) return;

    setInput('');
    addChatMessage({ role: 'user', content: msg, timestamp: Date.now() });
    setChatLoading(true);

    try {
      const response = await sendChatMessage(msg, chatMessages, lang);
      addChatMessage({
        role: 'assistant',
        content: response.message,
        actions: response.actions,
        timestamp: Date.now(),
      });

      if (response.actions?.length > 0) {
        executeActions(response.actions);
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: t('chat.error', lang),
        timestamp: Date.now(),
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hints = [
    t('chat.hint1', lang),
    t('chat.hint2', lang),
    t('chat.hint3', lang),
    t('chat.hint4', lang),
    t('chat.hint5', lang),
    t('chat.hint6', lang),
  ];

  if (!chatOpen) {
    return (
      <button
        onClick={() => setChatOpen(true)}
        className="absolute bottom-6 right-6 z-20 group cursor-pointer animate-fade-in"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl scale-150 group-hover:bg-blue-400/30 transition-all" />
          <div className="relative glass-panel rounded-full w-14 h-14 flex items-center justify-center group-hover:border-blue-400/50 transition-all">
            <StarIcon size={28} className="star-icon" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-void-900 shadow-lg shadow-green-400/50" />
        </div>
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-20 glass-panel w-96 animate-fade-in flex flex-col"
      style={{ height: '500px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20 flex items-center justify-center border border-blue-400/20">
              <StarIcon size={20} className="star-icon" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-void-900" />
          </div>
          <div>
            <div className="text-sm font-display font-semibold text-star-100 tracking-wide">StarAI</div>
            <div className="text-[10px] text-blue-300/60 font-mono">
              {chatLoading ? `✦ ${t('chat.analyzing', lang)}` : `✦ ${t('chat.ready', lang)}`}
            </div>
          </div>
        </div>
        <button
          onClick={() => setChatOpen(false)}
          className="text-star-500 hover:text-star-200 transition-colors w-7 h-7 rounded-full hover:bg-white/5 flex items-center justify-center"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center py-6">
            <div className="mb-4">
              <StarIcon size={36} className="mx-auto star-icon opacity-60" />
            </div>
            <div className="text-star-400 text-xs font-body mb-4">
              {t('chat.intro', lang)}<br />
              {t('chat.introSub', lang)}
            </div>
            <div className="space-y-1.5">
              {hints.map((hint) => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="block w-full text-left text-[11px] text-star-400 hover:text-star-200 px-3 py-1.5 rounded-lg hover:bg-blue-500/8 transition-all font-body border border-transparent hover:border-blue-500/15"
                >
                  ✦ {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 mt-1">
                <StarIcon size={18} />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-xs font-body leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 text-star-100 rounded-br-sm border border-blue-400/15'
                  : 'bg-white/5 text-star-200 rounded-bl-sm border border-white/8'
              }`}
            >
              {msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-white/8">
                  <span className="text-[9px] text-blue-300/60 font-mono">
                    ✦ {msg.actions.length} {msg.actions.length === 1 ? t('chat.actionDone_one', lang) : t('chat.actionDone_many', lang)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 mt-1">
              <StarIcon size={18} className="star-icon" />
            </div>
            <div className="bg-white/5 px-4 py-3 rounded-xl rounded-bl-sm border border-white/8">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder', lang)}
            className="chat-input flex-1 px-3 py-2.5 text-xs rounded-xl"
            disabled={chatLoading}
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="btn-star px-3 py-2.5 text-xs disabled:opacity-30 disabled:cursor-not-allowed rounded-xl"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
