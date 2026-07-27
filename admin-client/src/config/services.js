function normalizeBasePath(path) {
  if (!path || path === '/') return ''
  return `/${path.replace(/^\/+|\/+$/g, '')}`
}

export function joinServicePath(basePath, resourcePath) {
  const base = normalizeBasePath(basePath)
  const resource = String(resourcePath || '').replace(/^\/+/, '')
  return resource ? `${base}/${resource}` : (base || '/')
}

export function createServiceConfig({ isDev }) {
  return Object.freeze({
    ADMIN_AUTH_API_BASE: '/api/admin-auth',
    FAMILY_WAR_API_BASE: isDev ? '/api' : '/api/family-war',
  })
}

export const { ADMIN_AUTH_API_BASE, FAMILY_WAR_API_BASE } = createServiceConfig({
  isDev: import.meta.env.DEV,
})
