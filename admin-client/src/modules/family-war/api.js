import { FAMILY_WAR_API_BASE } from '../../config/services'

function request(path, options) {
  return fetch(`${FAMILY_WAR_API_BASE}${path}`, options)
}

function jsonRequest(path, method, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const familyWarAdminApi = {
  getStatus() {
    return request('/api/admin/status')
  },

  login(password) {
    return jsonRequest('/api/admin/login', 'POST', { password })
  },

  logout() {
    return request('/api/admin/logout', { method: 'POST' })
  },

  getWordConfig() {
    return request('/api/admin/word-config')
  },

  saveWordConfig(config) {
    return jsonRequest('/api/admin/word-config', 'POST', config)
  },

  syncAllWordImages() {
    return request('/api/admin/word-images/sync', { method: 'POST' })
  },

  syncMissingWordImages() {
    return request('/api/admin/word-images/sync-missing', { method: 'POST' })
  },

  getWordImageCandidates(word, page, perPage = 15) {
    const encodedWord = encodeURIComponent(word)
    return request(`/api/admin/word-images/candidates/${encodedWord}?page=${page}&perPage=${perPage}`)
  },

  confirmWordImage(word, candidateId) {
    return jsonRequest(
      `/api/admin/word-images/confirm/${encodeURIComponent(word)}`,
      'POST',
      { candidateId },
    )
  },

  getWordImageUrl(word, refreshKey = 0) {
    return `${FAMILY_WAR_API_BASE}/api/images/${encodeURIComponent(word)}?t=${refreshKey}`
  },
}
