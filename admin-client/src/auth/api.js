import { ADMIN_AUTH_API_BASE, joinServicePath } from '../config/services'
import { requestJson } from '../config/request'

function request(path, options) {
  return requestJson(joinServicePath(ADMIN_AUTH_API_BASE, path), options)
}

export const adminAuthApi = {
  login(password) {
    return request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
  },

  getCurrentAdmin() {
    return request('/me')
  },

  logout() {
    return request('/logout', { method: 'POST' })
  },
}
