/** Иконка в трее: CRM живёт там, пока окно закрыто, чтобы напоминания продолжали уходить. */
import { Menu, nativeImage, Tray } from 'electron'

const ICON_SIZE = 16
/** BGRA: круг цвета --accent (#f0a63c) из styles.css */
const ICON_COLOR = [0x3c, 0xa6, 0xf0, 0xff]

let tray: Tray | null = null

/** Рисуем иконку кодом: в проекте пока нет графических ресурсов. */
function buildIcon(): Electron.NativeImage {
  const pixels = Buffer.alloc(ICON_SIZE * ICON_SIZE * 4)
  const center = (ICON_SIZE - 1) / 2
  const radius = ICON_SIZE / 2 - 0.5
  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      if (Math.hypot(x - center, y - center) <= radius) {
        pixels.set(ICON_COLOR, (y * ICON_SIZE + x) * 4)
      }
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: ICON_SIZE, height: ICON_SIZE })
}

export function createTray(onShow: () => void, onQuit: () => void): void {
  if (tray) return
  tray = new Tray(buildIcon())
  tray.setToolTip('Низкий профиль CRM — напоминания включены')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть CRM', click: onShow },
      { type: 'separator' },
      { label: 'Выйти (напоминания остановятся)', click: onQuit }
    ])
  )
  tray.on('click', onShow)
}
