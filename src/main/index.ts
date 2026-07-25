import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { join } from 'node:path'
import { apiRequest, pingServer } from './api'
import { resetMock } from './mock'
import { isAllowedMethod, isSafeExternalUrl, sanitizeApiPath } from './security'
import { getPublicSettings, saveSettings } from './settings'
import type { HttpMethod, MenuCommand, SettingsPatch } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function send(command: MenuCommand): void {
  mainWindow?.webContents.send('crm:menu', command)
}

/** IPC только из нашего окна — чужой webContents (devtools extension и т.п.) отсекаем. */
function isOurSender(event: Electron.IpcMainInvokeEvent): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents)
}

function buildMenu(): void {
  const isDev = !app.isPackaged
  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'resetZoom', label: 'Обычный масштаб' },
    { role: 'zoomIn', label: 'Крупнее' },
    { role: 'zoomOut', label: 'Мельче' },
    { type: 'separator' },
    { role: 'togglefullscreen', label: 'Полный экран' }
  ]
  // DevTools только в разработке: в установленном .exe не светим внутренности
  if (isDev) {
    viewSubmenu.push({ role: 'toggleDevTools', label: 'Инструменты разработчика' })
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Заявки',
      submenu: [
        { label: 'Новый клиент', accelerator: 'CmdOrCtrl+N', click: () => send('new-booking') },
        { label: 'Обновить', accelerator: 'F5', click: () => send('refresh') },
        { type: 'separator' },
        { label: 'Настройки…', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
        { type: 'separator' },
        { label: 'Поиск', accelerator: 'CmdOrCtrl+F', click: () => send('focus-search') }
      ]
    },
    {
      label: 'День',
      submenu: [
        { label: 'Расписание', accelerator: 'CmdOrCtrl+1', click: () => send('page-day') },
        { label: 'Необработанные', accelerator: 'CmdOrCtrl+2', click: () => send('page-inbox') },
        { type: 'separator' },
        { label: 'Сегодня', accelerator: 'CmdOrCtrl+T', click: () => send('today') },
        { label: 'Предыдущий день', accelerator: 'CmdOrCtrl+Left', click: () => send('prev-day') },
        { label: 'Следующий день', accelerator: 'CmdOrCtrl+Right', click: () => send('next-day') }
      ]
    },
    { label: 'Вид', submenu: viewSubmenu },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'Сбросить демо-данные',
          click: async () => {
            const { response } = await dialog.showMessageBox({
              type: 'question',
              buttons: ['Отмена', 'Сбросить'],
              defaultId: 0,
              cancelId: 0,
              message: 'Вернуть демо-данные к исходному состоянию?',
              detail: 'Затрагивает только локальный демо-режим. Заявки на сервере не изменятся.'
            })
            if (response === 1) {
              resetMock()
              send('refresh')
            }
          }
        },
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              message: `Низкий профиль CRM ${app.getVersion()}`,
              detail:
                'Рабочее место администратора шиномонтажа.\n' +
                'Заявки хранятся на сервере сервиса, время — Москва (UTC+3).'
            })
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1040,
    minHeight: 620,
    show: false,
    backgroundColor: '#0e1116',
    title: 'Низкий профиль — CRM',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Блокируем навигацию окна на внешние URL (защита от open-redirect в разметке)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']?.replace('://localhost', '://127.0.0.1')
    const allowed =
      (devUrl && url.startsWith(devUrl)) ||
      url.startsWith('file://') ||
      url === 'about:blank'
    if (!allowed) event.preventDefault()
  })

  const rawDevUrl = process.env['ELECTRON_RENDERER_URL']
  const devUrl = rawDevUrl?.replace('://localhost', '://127.0.0.1')

  if (devUrl) {
    void loadDevUrl(mainWindow, devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function loadDevUrl(win: BrowserWindow, url: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (win.isDestroyed()) return
    try {
      await win.loadURL(url)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  if (!win.isDestroyed()) {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        '<body style="background:#0e1116;color:#e7ecf3;font:14px Segoe UI;padding:40px">' +
          '<h1>Не удалось открыть интерфейс</h1>' +
          '<p>Vite не отвечает. Закройте CRM и снова выполните <code>npm run dev</code>.</p></body>'
      )}`
    )
  }
}

function registerIpc(): void {
  ipcMain.handle('crm:request', (event, method: unknown, path: unknown, body?: unknown) => {
    if (!isOurSender(event)) return { ok: false, error: 'Forbidden', status: 403 }
    if (!isAllowedMethod(method) || !sanitizeApiPath(path)) {
      return { ok: false, error: 'Недопустимый запрос', status: 400 }
    }
    const safeBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined
    return apiRequest(method, path as string, safeBody)
  })

  ipcMain.handle('crm:ping', (event) => {
    if (!isOurSender(event)) return { ok: false, error: 'Forbidden', status: 403 }
    return pingServer()
  })

  ipcMain.handle('crm:settings:get', (event) => {
    if (!isOurSender(event)) return null
    return getPublicSettings()
  })

  ipcMain.handle('crm:settings:save', (event, patch: unknown) => {
    if (!isOurSender(event)) throw new Error('Forbidden')
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('Некорректные настройки')
    }
    return saveSettings(patch as SettingsPatch)
  })

  ipcMain.handle('crm:open-external', (event, url: unknown) => {
    if (!isOurSender(event)) return
    if (isSafeExternalUrl(url)) void shell.openExternal(url as string)
  })

  ipcMain.handle(
    'crm:confirm',
    async (
      event,
      options: { message?: unknown; detail?: unknown; confirmLabel?: unknown; danger?: unknown }
    ) => {
      if (!isOurSender(event) || !mainWindow) return false
      const message = String(options?.message ?? '').slice(0, 300)
      if (!message) return false
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: options?.danger ? 'warning' : 'question',
        buttons: ['Отмена', String(options?.confirmLabel ?? 'Продолжить').slice(0, 40)],
        defaultId: 1,
        cancelId: 0,
        noLink: true,
        message,
        detail: options?.detail !== undefined ? String(options.detail).slice(0, 600) : undefined
      })
      return response === 1
    }
  )
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('ru.nizkiyprofil.crm')
    registerIpc()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
