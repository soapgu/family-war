function normalizeBasePath(path) {
  if (!path || path === '/') return ''
  return `/${path.replace(/^\/+|\/+$/g, '')}`
}

export function joinServicePath(basePath, resourcePath) {
  const base = normalizeBasePath(basePath)
  const resource = String(resourcePath || '').replace(/^\/+/, '')
  return resource ? `${base}/${resource}` : (base || '/')
}

export function createServiceConfig({ isDev, publicBase }) {
  return Object.freeze({
    PUBLIC_BASE: normalizeBasePath(publicBase),
    FAMILY_WAR_API_BASE: isDev ? '/api' : '/api/family-war',
    FAMILY_WAR_SOCKET_PATH: isDev ? '/socket.io' : '/socket/family-war/',
  })
}

export const {
  PUBLIC_BASE,
  FAMILY_WAR_API_BASE,
  FAMILY_WAR_SOCKET_PATH,
} = createServiceConfig({
  isDev: import.meta.env.DEV,
  publicBase: import.meta.env.BASE_URL,
})
