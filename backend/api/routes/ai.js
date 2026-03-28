/**
 * Маршруты AI-ассистента
 *
 * Обработка текстовых команд (в том числе на русском языке),
 * генерация ответов и преобразование команд в UI-действия.
 */

const express = require('express');
const router = express.Router();
const aiAssistant = require('../../services/aiAssistant');

/**
 * POST /api/ai/chat
 * Обрабатывает сообщение пользователя и возвращает ответ ассистента
 *
 * Тело запроса:
 * {
 *   message: "текст сообщения",
 *   context: { selectedSatellite, currentTime, cameraMode, ... }
 * }
 */
router.post('/chat', (req, res) => {
  const { message, context = {} } = req.body;

  if (!message) {
    return res.status(400).json({
      error: 'Необходимо передать поле message'
    });
  }

  try {
    const result = aiAssistant.processMessage(message, context);

    res.json({
      reply: result.response,
      intent: result.intent,
      action: result.action || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Ошибка AI-ассистента:', err.message);
    res.status(500).json({ error: 'Ошибка обработки сообщения' });
  }
});

/**
 * POST /api/ai/command
 * Распознаёт команду и возвращает структурированное UI-действие
 *
 * Тело запроса:
 * {
 *   command: "покажи спутник SiriusSat-1"
 * }
 */
router.post('/command', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({
      error: 'Необходимо передать поле command'
    });
  }

  try {
    const action = aiAssistant.parseCommand(command);

    res.json({
      command,
      parsed: action,
      success: action.action !== 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Ошибка разбора команды:', err.message);
    res.status(500).json({ error: 'Ошибка разбора команды' });
  }
});

module.exports = router;
