export const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.BASE_URL || '').replace(/\/$/, '')
