// ═══════════════════════════════════════════════════════════════
//  AI АССИСТЕНТ — Модуль взаимодействия с нейросетью
//  Распознаёт команды на русском языке и управляет интерфейсом
// ═══════════════════════════════════════════════════════════════

const API_URL = '/api/ai';

// Карта команд: паттерн → действие
const COMMAND_PATTERNS = [
  { pattern: /покажи\s+спутник\s+(.+)/i, action: 'selectSatellite', extract: m => ({ name: m[1].trim() }) },
  { pattern: /выбери\s+спутник\s+(.+)/i, action: 'selectSatellite', extract: m => ({ name: m[1].trim() }) },
  { pattern: /переключи\s+(?:камеру\s+)?на\s+(.+)/i, action: 'focusSatellite', extract: m => ({ name: m[1].trim() }) },
  { pattern: /ускор[ьи]\s+время/i, action: 'setSpeed', extract: () => ({ speed: 100 }) },
  { pattern: /замедл[ьи]\s+время/i, action: 'setSpeed', extract: () => ({ speed: 1 }) },
  { pattern: /скорость\s+[×xх]?\s*(\d+)/i, action: 'setSpeed', extract: m => ({ speed: parseInt(m[1]) }) },
  { pattern: /пауза|останов/i, action: 'togglePause', extract: () => ({}) },
  { pattern: /продолж|запуст|старт/i, action: 'resume', extract: () => ({}) },
  { pattern: /покажи\s+орбиты/i, action: 'toggleOrbits', extract: () => ({ show: true }) },
  { pattern: /скрой\s+орбиты/i, action: 'toggleOrbits', extract: () => ({ show: false }) },
  { pattern: /покажи\s+покрытие/i, action: 'toggleCoverage', extract: () => ({ show: true }) },
  { pattern: /скрой\s+покрытие/i, action: 'toggleCoverage', extract: () => ({ show: false }) },
  { pattern: /покажи\s+(?:наземные\s+)?станции/i, action: 'toggleGS', extract: () => ({ show: true }) },
  { pattern: /скрой\s+(?:наземные\s+)?станции/i, action: 'toggleGS', extract: () => ({ show: false }) },
  { pattern: /сброс|сбрось|начальн/i, action: 'resetView', extract: () => ({}) },
  { pattern: /высот[уа]\s+(\d+)/i, action: 'setAltitude', extract: m => ({ altitude: parseInt(m[1]) }) },
  { pattern: /наклонени[ея]\s+([\d.]+)/i, action: 'setInclination', extract: m => ({ inclination: parseFloat(m[1]) }) },
  { pattern: /(\d+)\s+плоскост/i, action: 'setPlanes', extract: m => ({ planes: parseInt(m[1]) }) },
  { pattern: /расскажи\s+(?:о\s+|про\s+)?(.+)/i, action: 'describe', extract: m => ({ topic: m[1].trim() }) },
  { pattern: /(?:что такое|объясни)\s+(.+)/i, action: 'explain', extract: m => ({ topic: m[1].trim() }) },
  { pattern: /статус|телеметри/i, action: 'getStatus', extract: () => ({}) },
  { pattern: /помощь|help|команды/i, action: 'showHelp', extract: () => ({}) },
];

/**
 * Парсит пользовательское сообщение и извлекает команду
 * @param {string} message - Сообщение пользователя
 * @returns {{ action: string, params: object } | null}
 */
export function parseCommand(message) {
  for (const cmd of COMMAND_PATTERNS) {
    const match = message.match(cmd.pattern);
    if (match) {
      return { action: cmd.action, params: cmd.extract(match) };
    }
  }
  return null;
}

/**
 * Генерирует локальный ответ без обращения к серверу
 * @param {string} action - Тип действия
 * @param {object} params - Параметры действия
 * @param {object} context - Контекст сцены
 * @returns {string} Текст ответа
 */
export function generateLocalResponse(action, params, context) {
  const responses = {
    selectSatellite: `Переключаю на спутник ${params.name}`,
    focusSatellite: `Навожу камеру на ${params.name}`,
    setSpeed: `Скорость симуляции установлена: ×${params.speed}`,
    togglePause: 'Симуляция приостановлена',
    resume: 'Симуляция возобновлена',
    toggleOrbits: params.show ? 'Орбиты отображены' : 'Орбиты скрыты',
    toggleCoverage: params.show ? 'Зоны покрытия отображены' : 'Зоны покрытия скрыты',
    toggleGS: params.show ? 'Наземные станции отображены' : 'Наземные станции скрыты',
    resetView: 'Вид сброшен в начальное положение',
    setAltitude: `Высота орбиты изменена: ${params.altitude} км`,
    setInclination: `Наклонение изменено: ${params.inclination}°`,
    setPlanes: `Количество плоскостей: ${params.planes}`,
    getStatus: formatStatus(context),
    showHelp: getHelpText(),
  };
  return responses[action] || 'Команда выполнена';
}

function formatStatus(ctx) {
  if (!ctx) return 'Данные о состоянии группировки загружаются...';
  return `📡 Группировка: ${ctx.totalSats || '—'} КА в ${ctx.planes || '—'} плоскостях\n` +
    `🌍 Высота: ${ctx.altitude || '—'} км | Наклонение: ${ctx.inclination || '—'}°\n` +
    `⚡ Покрытие: ${ctx.coverage || '—'}%`;
}

function getHelpText() {
  return `Доступные команды:\n` +
    `• «покажи спутник СК-0301» — выбрать спутник\n` +
    `• «переключи камеру на СК-0201» — навести камеру\n` +
    `• «ускорь время» / «скорость ×100» — управление временем\n` +
    `• «покажи орбиты/покрытие/станции» — визуализация\n` +
    `• «высота 600» — изменить высоту орбиты\n` +
    `• «расскажи о J2 прецессии» — получить информацию\n` +
    `• «статус» — текущая телеметрия\n` +
    `• «сброс» — начальный вид`;
}

/**
 * Отправляет сообщение на сервер AI
 * @param {string} message - Сообщение пользователя
 * @param {object} context - Контекст сцены (параметры, телеметрия)
 * @returns {Promise<{ text: string, action?: object }>}
 */
export async function sendMessage(message, context) {
  // Сначала пробуем локальный парсинг команд
  const localCmd = parseCommand(message);
  if (localCmd && localCmd.action !== 'describe' && localCmd.action !== 'explain') {
    return {
      text: generateLocalResponse(localCmd.action, localCmd.params, context),
      action: localCmd,
    };
  }

  // Для сложных запросов — обращаемся к серверу
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Фолбэк: локальный ответ при недоступности сервера
    if (localCmd) {
      return {
        text: generateLocalResponse(localCmd.action, localCmd.params, context),
        action: localCmd,
      };
    }
    return {
      text: 'Нейросеть временно недоступна. Попробуйте команду из списка (напишите «помощь»).',
      action: null,
    };
  }
}

/**
 * Класс UI чат-панели AI ассистента
 */
export class AIPanel {
  constructor(containerSelector, onAction) {
    this.container = document.querySelector(containerSelector);
    this.onAction = onAction;
    this.messages = [];
    this.isOpen = false;
    this.init();
  }

  init() {
    if (!this.container) return;

    // Приветственное сообщение
    this.addMessage('assistant',
      'Привет! Я AI-ассистент StarVision. Управляю визуализацией и отвечаю на вопросы о группировке кубсатов. Напишите «помощь» для списка команд.'
    );

    // Бинд отправки
    const input = this.container.querySelector('.ai-input');
    const sendBtn = this.container.querySelector('.ai-send-btn');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend(input.value);
          input.value = '';
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (input) {
          this.handleSend(input.value);
          input.value = '';
        }
      });
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container?.classList.toggle('open', this.isOpen);
  }

  async handleSend(text) {
    if (!text.trim()) return;
    this.addMessage('user', text.trim());
    this.showTyping();

    const context = this.onAction ? this.onAction('getContext', {}) : null;
    const response = await sendMessage(text.trim(), context);

    this.hideTyping();
    this.addMessage('assistant', response.text);

    // Выполнить действие если есть
    if (response.action && this.onAction) {
      this.onAction(response.action.action, response.action.params);
      this.showActionBadge(response.text);
    }
  }

  addMessage(role, text) {
    this.messages.push({ role, text, time: new Date() });
    const messagesEl = this.container?.querySelector('.ai-messages');
    if (!messagesEl) return;

    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ${role}`;
    msgEl.textContent = text;
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  showTyping() {
    const messagesEl = this.container?.querySelector('.ai-messages');
    if (!messagesEl) return;
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.id = 'aiTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  hideTyping() {
    document.getElementById('aiTyping')?.remove();
  }

  showActionBadge(text) {
    const badge = this.container?.querySelector('.ai-action-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.classList.add('visible');
    setTimeout(() => badge.classList.remove('visible'), 3000);
  }
}
