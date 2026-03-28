/**
 * AI-ассистент StarVision
 *
 * Обработка текстовых команд на русском языке,
 * извлечение намерений (intent) и генерация ответов.
 *
 * Поддерживаемые команды:
 *   - «покажи спутник X» → выбрать и показать спутник
 *   - «ускорь время» / «замедли время» → управление скоростью симуляции
 *   - «переключи камеру» → смена режима камеры
 *   - «расскажи о спутнике X» → информация о спутнике
 *   - «покажи орбиту» → отображение орбитальной трассы
 *   - «сбрось вид» → возврат камеры в исходное положение
 *   - «включи/выключи метки» → управление отображением меток
 */

// ========================================================
//  Карта команд (русский язык → действия)
// ========================================================

/**
 * Словарь распознаваемых команд.
 * Ключ — регулярное выражение для поиска в тексте.
 * Значение — описание действия и функция извлечения параметров.
 */
const COMMAND_MAP = [
  {
    // «покажи спутник SiriusSat-1», «выбери аппарат Yarilo»
    patterns: [
      /(?:покажи|выбери|найди|выдели|открой)\s+(?:спутник|аппарат|кубсат|сат)\s+(.+)/i,
      /(?:покажи|выбери|найди)\s+(.+)/i
    ],
    action: 'selectSatellite',
    extractParams: (match) => ({ name: match[1].trim() }),
    description: 'Выбрать и показать спутник'
  },
  {
    // «расскажи о спутнике X», «информация о SiriusSat-1»
    patterns: [
      /(?:расскажи|расскажи подробнее|инфо|информация)\s+(?:о|об|про)\s+(?:спутнике|аппарате|кубсате)?\s*(.+)/i,
      /(?:что за|что такое)\s+(.+)/i
    ],
    action: 'showInfo',
    extractParams: (match) => ({ name: match[1].trim() }),
    description: 'Показать информацию о спутнике'
  },
  {
    // «ускорь время», «быстрее», «ускорить в 10 раз»
    patterns: [
      /(?:ускор|быстре|увеличь скорость|ускорить)\s*(?:время|симуляци.)?\s*(?:в\s+(\d+)\s+раз)?/i,
      /(?:время\s+)?быстрее/i
    ],
    action: 'speedUp',
    extractParams: (match) => ({
      factor: match[1] ? parseInt(match[1], 10) : 2
    }),
    description: 'Ускорить время симуляции'
  },
  {
    // «замедли время», «медленнее», «замедлить в 2 раза»
    patterns: [
      /(?:замедл|медленне|уменьши скорость|замедлить)\s*(?:время|симуляци.)?\s*(?:в\s+(\d+)\s+раз)?/i,
      /(?:время\s+)?медленнее/i
    ],
    action: 'slowDown',
    extractParams: (match) => ({
      factor: match[1] ? parseInt(match[1], 10) : 2
    }),
    description: 'Замедлить время симуляции'
  },
  {
    // «пауза», «останови время», «стоп»
    patterns: [
      /(?:пауза|останов|стоп|заморозь|приостанов)/i
    ],
    action: 'pause',
    extractParams: () => ({}),
    description: 'Приостановить симуляцию'
  },
  {
    // «продолжи», «запусти», «играй», «старт»
    patterns: [
      /(?:продолж|запусти|играй|старт|возобнов|пуск)/i
    ],
    action: 'resume',
    extractParams: () => ({}),
    description: 'Возобновить симуляцию'
  },
  {
    // «переключи камеру», «вид сверху», «вид от спутника»
    patterns: [
      /(?:переключи|сменить?|изменить?)\s+(?:камер|вид|ракурс)/i,
      /вид\s+(?:сверху|сбоку|от\s+спутника|свободный|глобальный)/i
    ],
    action: 'switchCamera',
    extractParams: (match) => {
      const text = match[0].toLowerCase();
      let mode = 'next';
      if (text.includes('сверху')) mode = 'top';
      else if (text.includes('сбоку')) mode = 'side';
      else if (text.includes('от спутника')) mode = 'satellite';
      else if (text.includes('свободный')) mode = 'free';
      else if (text.includes('глобальный')) mode = 'global';
      return { mode };
    },
    description: 'Переключить режим камеры'
  },
  {
    // «покажи орбиту», «нарисуй трассу», «покажи траекторию»
    patterns: [
      /(?:покажи|нарисуй|отобрази)\s+(?:орбит|трасс|траектори|путь)/i
    ],
    action: 'showOrbit',
    extractParams: () => ({}),
    description: 'Показать орбитальную трассу'
  },
  {
    // «сбрось вид», «вернись», «домой», «сбросить камеру»
    patterns: [
      /(?:сбрось|верни|сброс|домой|начальн)\s*(?:вид|камер|положени)?/i
    ],
    action: 'resetView',
    extractParams: () => ({}),
    description: 'Сбросить камеру в начальное положение'
  },
  {
    // «включи метки», «выключи имена», «скрой подписи»
    patterns: [
      /(?:включи|покажи|отобрази)\s+(?:метки|имена|подписи|названи)/i
    ],
    action: 'toggleLabels',
    extractParams: () => ({ visible: true }),
    description: 'Включить отображение меток'
  },
  {
    patterns: [
      /(?:выключи|скрой|убери|спрячь)\s+(?:метки|имена|подписи|названи)/i
    ],
    action: 'toggleLabels',
    extractParams: () => ({ visible: false }),
    description: 'Выключить отображение меток'
  },
  {
    // «покажи все спутники», «список спутников»
    patterns: [
      /(?:покажи все|список|каталог|перечень)\s*(?:спутник|аппарат|кубсат)?/i
    ],
    action: 'showCatalog',
    extractParams: () => ({}),
    description: 'Показать каталог спутников'
  },
  {
    // «помощь», «помоги», «что ты умеешь»
    patterns: [
      /(?:помощь|помоги|справка|что (?:ты )?умеешь|команды|help)/i
    ],
    action: 'showHelp',
    extractParams: () => ({}),
    description: 'Показать справку по командам'
  }
];

// ========================================================
//  Словарь ответов
// ========================================================

const RESPONSES = {
  selectSatellite: (params) =>
    `Переключаюсь на спутник «${params.name}». Навожу камеру...`,
  showInfo: (params) =>
    `Загружаю информацию о спутнике «${params.name}»...`,
  speedUp: (params) =>
    `Ускоряю время симуляции в ${params.factor} раз.`,
  slowDown: (params) =>
    `Замедляю время симуляции в ${params.factor} раз.`,
  pause: () =>
    'Симуляция приостановлена.',
  resume: () =>
    'Симуляция возобновлена.',
  switchCamera: (params) => {
    const modeNames = {
      top: 'вид сверху', side: 'вид сбоку',
      satellite: 'вид от спутника', free: 'свободная камера',
      global: 'глобальный вид', next: 'следующий режим'
    };
    return `Переключаю камеру: ${modeNames[params.mode] || params.mode}.`;
  },
  showOrbit: () =>
    'Отображаю орбитальную трассу выбранного спутника.',
  resetView: () =>
    'Возвращаю камеру в начальное положение.',
  toggleLabels: (params) =>
    params.visible ? 'Метки спутников включены.' : 'Метки спутников скрыты.',
  showCatalog: () =>
    'Открываю каталог российских кубсатов.',
  showHelp: () =>
    'Доступные команды:\n' +
    '• «покажи спутник [название]» — выбрать спутник\n' +
    '• «расскажи о [название]» — информация о спутнике\n' +
    '• «ускорь/замедли время» — управление симуляцией\n' +
    '• «переключи камеру» — сменить ракурс\n' +
    '• «покажи орбиту» — орбитальная трасса\n' +
    '• «сбрось вид» — начальное положение камеры',
  unknown: () =>
    'Не удалось распознать команду. Попробуйте «помощь» для списка доступных команд.',
  greeting: () =>
    'Здравствуйте! Я ассистент StarVision. Спрашивайте о спутниках или давайте команды для управления визуализацией.',
  error: () =>
    'Произошла ошибка при обработке запроса. Попробуйте ещё раз.'
};

// ========================================================
//  Основные функции
// ========================================================

/**
 * Обрабатывает сообщение пользователя
 *
 * @param {string} message — текст сообщения
 * @param {object} sceneContext — контекст сцены (выбранный спутник, время и т.д.)
 * @returns {object} { intent, action, response }
 */
function processMessage(message, sceneContext = {}) {
  if (!message || typeof message !== 'string') {
    return {
      intent: 'error',
      action: null,
      response: RESPONSES.error()
    };
  }

  const trimmed = message.trim();

  // Проверяем, не приветствие ли это
  if (isGreeting(trimmed)) {
    return {
      intent: 'greeting',
      action: null,
      response: RESPONSES.greeting()
    };
  }

  // Извлекаем намерение и команду
  const intent = extractIntent(trimmed);

  // Генерируем действие для UI
  const action = intent.action !== 'unknown'
    ? { action: intent.action, params: intent.params }
    : null;

  // Генерируем текстовый ответ
  const response = generateResponse(intent.action, intent.params);

  return {
    intent: intent.action,
    action,
    response
  };
}

/**
 * Извлекает намерение из текста сообщения
 * Базовый NLP: сопоставление с регулярными выражениями
 *
 * @param {string} message — текст сообщения
 * @returns {object} { action, params, confidence }
 */
function extractIntent(message) {
  const normalized = message.toLowerCase().trim();

  // Перебираем все шаблоны команд
  for (const command of COMMAND_MAP) {
    for (const pattern of command.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          action: command.action,
          params: command.extractParams(match),
          confidence: 0.8,
          matchedPattern: pattern.source,
          description: command.description
        };
      }
    }
  }

  // Команда не распознана
  return {
    action: 'unknown',
    params: {},
    confidence: 0,
    matchedPattern: null,
    description: 'Нераспознанная команда'
  };
}

/**
 * Генерирует текстовый ответ по намерению и параметрам
 *
 * @param {string} intent — намерение (action)
 * @param {object} data — параметры команды
 * @returns {string} текст ответа
 */
function generateResponse(intent, data = {}) {
  const generator = RESPONSES[intent] || RESPONSES.unknown;
  return generator(data);
}

/**
 * Разбирает команду и возвращает структурированное действие для UI
 * (используется из маршрута POST /api/ai/command)
 *
 * @param {string} command — текстовая команда
 * @returns {object} { action, params, description }
 */
function parseCommand(command) {
  const intent = extractIntent(command);

  return {
    action: intent.action,
    params: intent.params,
    confidence: intent.confidence,
    description: intent.description
  };
}

// ========================================================
//  Вспомогательные функции
// ========================================================

/**
 * Проверяет, является ли сообщение приветствием
 *
 * @param {string} message
 * @returns {boolean}
 */
function isGreeting(message) {
  const greetings = [
    /^привет/i, /^здравствуй/i, /^добр(ый|ое|ого)/i,
    /^хай/i, /^хелло/i, /^hello/i, /^hi\b/i,
    /^салют/i, /^йо\b/i
  ];

  return greetings.some(pattern => pattern.test(message));
}

module.exports = {
  processMessage,
  extractIntent,
  generateResponse,
  parseCommand,
  COMMAND_MAP,
  RESPONSES
};
