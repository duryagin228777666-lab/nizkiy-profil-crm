/// <reference types="vite/client" />

import type { CrmBridge } from '../../preload'

declare global {
  interface Window {
    crm: CrmBridge
  }
}

export {}
