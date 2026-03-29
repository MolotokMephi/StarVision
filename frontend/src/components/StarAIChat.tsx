import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { sendChatMessage } from '../services/api';

export function StarAIChat() {
  const {
    chatOpen, setChatOpen,
    chatMessages, addChatMessage,
    chatLoading, setChatLoading,
    // actions that StarAI can trigger
    focusSatellite,
    setTimeSpeed,
    setShowOrbits,
    highlightConstellation,
    resetView,
  } = useStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Обработка действий StarAI
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
        case 'highlight_constellation':
          highlightConstellation(action.name);
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
      const response = await sendChatMessage(msg, chatMessages);
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
        content: 'Ошибка связи с сервером. Попробуйте позже.',
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

  if (!chatOpen) {
    return (
      <button
        onClick={() => setChatOpen(true)}
        className="absolute bottom-4 right-4 z-20 glass-panel px-4 py-3 flex items-center gap-3 cursor-pointer group hover:border-star-400 transition-all animate-fade-in"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-star-500 to-star-700 flex items-center justify-center">
            <span className="text-white text-sm font-display font-bold">AI</span>
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-void-900" />
        </div>
        <div className="text-left">
          <div className="text-xs font-display font-semibold text-star-200">StarAI</div>
          <div className="text-[10px] text-star-500">Спроси о спутниках</div>
        </div>
      </button>
    );
  }

  return (
    <div
      className="absolute bottom-4 right-4 z-20 glass-panel w-96 animate-fade-in flex flex-col"
      style={{ height: '480px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-star-900/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-star-500 to-star-700 flex items-center justify-center">
            <span className="text-white text-xs font-display font-bold">AI</span>
          </div>
          <div>
            <div className="text-xs font-display font-semibold text-star-200">StarAI</div>
            <div className="text-[9px] text-star-500 font-mono">
              {chatLoading ? 'Думаю...' : 'Онлайн'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setChatOpen(false)}
          className="text-star-500 hover:text-star-200 transition-colors text-lg"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-star-600 text-xs font-body mb-3">
              Привет! Я StarAI — ассистент StarGrid.
            </div>
            <div className="space-y-1.5">
              {['Расскажи про Сферу', 'Покажи Гонец', 'Ускорь время'].map((hint) => (
                <button
                  key={hint}
                  onClick={() => {
                    setInput(hint);
                  }}
                  className="block w-full text-left text-[11px] text-star-400 hover:text-star-200 px-3 py-1.5 rounded-md hover:bg-star-950/50 transition-all font-body"
                >
                  → {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-xs font-body leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-star-700/40 text-star-100 rounded-br-sm'
                  : 'bg-void-700/80 text-star-200 rounded-bl-sm border border-star-900/30'
              }`}
            >
              {msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-star-800/30">
                  <span className="text-[9px] text-star-500 font-mono">
                    ⚡ {msg.actions.length} действ.
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-void-700/80 px-3 py-2 rounded-lg rounded-bl-sm border border-star-900/30">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-star-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-star-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-star-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-star-900/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спроси StarAI..."
            className="chat-input flex-1 px-3 py-2 text-xs"
            disabled={chatLoading}
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="btn-star px-3 py-2 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}
