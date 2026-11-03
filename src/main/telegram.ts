/**
 * Бот CRM в Telegram: ловит «Старт» по ссылке t.me/<бот>?start=<код> и привязывает клиента к заявке.
 *
 * Long-poll getUpdates работает, пока CRM запущена. Нажатия, пока CRM закрыта, Telegram хранит
 * до суток и отдаёт при следующем запуске. Боту нужен свой токен: тот же бот, что у сайта,
 * даст конфликт 409 — два getUpdates на один бот Telegram не разрешает.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatVisitHuman } from '../shared/time'
import { linkTelegram, setBotUsername } from './localStore'
import { telegramCall } from './messaging'
import { parseStartCode } from './rules'
import { getSecrets, userDataDir } from './settings'

const POLL_TIMEOUT_SEC = 25
const RETRY_MS = 15_000
/** Первый 409 обычно от нашего же прошлого запроса после перезапуска — повторяем быстро */
const CONFLICT_FIRST_RETRY_MS = 3_000
const CONFLICT_RETRY_MS = 60_000
/** Неверных кодов с одного чата, после которых бот перестаёт отвечать (защита от перебора) */
const MAX_FAILED_CODES = 5
const START_COMMAND = /^\/start(@\w+)?(\s|$)/

interface TelegramUpdate {
  update_id: number
  message?: { text?: string; chat: { id: number; type: string } }
}

/** Каждый перезапуск получает свой номер и свой AbortController; старый цикл видит смену и выходит. */
let generation = 0
let abort: AbortController | null = null
const failedCodes = new Map<number, number>()

function stateFile(): string {
  return join(userDataDir(), 'telegram-state.json')
}

/** id бота — часть токена до двоеточия; offset чужого бота отбросил бы новые обновления. */
function botId(token: string): string {
  return token.split(':')[0] ?? ''
}

function readOffset(bot: string): number {
  try {
    if (!existsSync(stateFile())) return 0
    const parsed = JSON.parse(readFileSync(stateFile(), 'utf-8')) as { botId?: unknown; offset?: unknown }
    return parsed.botId === bot ? Number(parsed.offset) || 0 : 0
  } catch {
    return 0
  }
}

function saveOffset(bot: string, offset: number): void {
  const file = stateFile()
  writeFileSync(`${file}.tmp`, JSON.stringify({ botId: bot, offset }), 'utf-8')
  renameSync(`${file}.tmp`, file)
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function reply(chatId: number, text: string): Promise<void> {
  const result = await telegramCall('sendMessage', { chat_id: chatId, text })
  if (!result.ok) console.error(`[telegram] ответ клиенту не ушёл: ${result.error}`)
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message
  if (!message?.text || message.chat.type !== 'private') return
  if (!START_COMMAND.test(message.text.trim())) return

  const chatId = message.chat.id
  const failures = failedCodes.get(chatId) ?? 0
  if (failures >= MAX_FAILED_CODES) return

  const code = parseStartCode(message.text)
  if (!code) {
    await reply(chatId, 'Здравствуйте! Чтобы получать напоминания, откройте ссылку из сообщения шиномонтажа.')
    return
  }
  const result = linkTelegram(code, chatId)
  if (result.status === 'not_found') {
    failedCodes.set(chatId, failures + 1)
    await reply(chatId, `Запись с кодом ${code} не найдена. Позвоните нам, мы проверим.`)
    return
  }
  if (result.status === 'taken') {
    // Другой чат уже привязан: не перехватываем напоминания и не раскрываем время визита
    failedCodes.set(chatId, failures + 1)
    await reply(chatId, 'Эта запись уже подключена к другому Telegram. Если это ошибка — позвоните нам.')
    return
  }
  const when = result.booking.visit_at ? ` (${formatVisitHuman(result.booking.visit_at)})` : ''
  await reply(chatId, `Готово! Напоминания о записи ${code}${when} будут приходить сюда.`)
  console.log(`[telegram] клиент привязан к заявке ${code}`)
}

/** Имя бота нужно для ссылок; при сбое сети на старте спрашиваем снова на следующем круге. */
async function fetchUsername(signal: AbortSignal): Promise<boolean> {
  const me = await telegramCall<{ username?: string }>('getMe', {}, undefined, signal)
  if (!me.ok) {
    if (!signal.aborted) console.error(`[telegram] бот не отвечает: ${me.error}`)
    return false
  }
  setBotUsername(me.result.username ?? '')
  return true
}

async function pollLoop(own: number, bot: string, signal: AbortSignal): Promise<void> {
  let named = false
  let conflicts = 0
  let offset = readOffset(bot)
  while (own === generation) {
    if (!named) named = await fetchUsername(signal)
    if (own !== generation) return
    const result = await telegramCall<TelegramUpdate[]>(
      'getUpdates',
      { offset, timeout: POLL_TIMEOUT_SEC, allowed_updates: ['message'] },
      (POLL_TIMEOUT_SEC + 10) * 1000,
      signal
    )
    if (own !== generation) return
    if (!result.ok) {
      if (result.code === 409) {
        conflicts += 1
        if (conflicts > 1) {
          console.error('[telegram] бот уже используется другой программой (сайт?) — нужен отдельный бот для CRM')
        }
      } else {
        console.error(`[telegram] getUpdates: ${result.error}`)
      }
      const conflictDelay = conflicts > 1 ? CONFLICT_RETRY_MS : CONFLICT_FIRST_RETRY_MS
      await sleep(result.code === 409 ? conflictDelay : RETRY_MS)
      continue
    }
    conflicts = 0
    for (const update of result.result) {
      offset = update.update_id + 1
      try {
        await handleUpdate(update)
      } catch (error) {
        console.error('[telegram] сбой обработки сообщения:', error)
      }
    }
    if (result.result.length > 0) saveOffset(bot, offset)
  }
}

/** Запустить или перезапустить бота под текущий токен из настроек. */
export function restartTelegram(): void {
  generation += 1
  abort?.abort()
  abort = null
  setBotUsername('')
  const token = getSecrets().telegramBotToken
  if (!token) return
  abort = new AbortController()
  void pollLoop(generation, botId(token), abort.signal)
}
