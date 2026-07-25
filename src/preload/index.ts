import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  HttpMethod,
  MenuCommand,
  PublicSettings,
  SettingsPatch
} from '../shared/types'

export interface ConfirmOptions {
  message: string
  detail?: string
  confirmLabel?: string
  danger?: boolean
}

const bridge = {
  request(method: HttpMethod, path: string, body?: Record<string, unknown>): Promise<ApiResult<unknown>> {
    return ipcRenderer.invoke('crm:request', method, path, body)
  },
  ping(): Promise<ApiResult<unknown>> {
    return ipcRenderer.invoke('crm:ping')
  },
  getSettings(): Promise<PublicSettings> {
    return ipcRenderer.invoke('crm:settings:get')
  },
  saveSettings(patch: SettingsPatch): Promise<PublicSettings> {
    return ipcRenderer.invoke('crm:settings:save', patch)
  },
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('crm:open-external', url)
  },
  confirm(options: ConfirmOptions): Promise<boolean> {
    return ipcRenderer.invoke('crm:confirm', options)
  },
  onMenuCommand(handler: (command: MenuCommand) => void): () => void {
    const listener = (_event: unknown, command: MenuCommand): void => handler(command)
    ipcRenderer.on('crm:menu', listener)
    return () => ipcRenderer.removeListener('crm:menu', listener)
  },
  platform: process.platform
}

export type CrmBridge = typeof bridge

contextBridge.exposeInMainWorld('crm', bridge)
