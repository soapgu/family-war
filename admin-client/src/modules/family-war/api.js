import { FAMILY_WAR_API_BASE, joinServicePath } from '../../config/services'
import { requestJson } from '../../config/request'

function request(path, options) {
  return requestJson(joinServicePath(FAMILY_WAR_API_BASE, path), options)
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
    return request('/admin/status')
  },

  login(password) {
    return jsonRequest('/admin/login', 'POST', { password })
  },

  logout() {
    return request('/admin/logout', { method: 'POST' })
  },

  getWordConfig() {
    return request('/admin/word-config')
  },

  saveWordConfig(config) {
    return jsonRequest('/admin/word-config', 'POST', config)
  },

  syncAllWordImages() {
    return request('/admin/word-images/sync', { method: 'POST' })
  },

  syncMissingWordImages() {
    return request('/admin/word-images/sync-missing', { method: 'POST' })
  },

  getWordImageCandidates(word, page, perPage = 15) {
    const encodedWord = encodeURIComponent(word)
    return request(`/admin/word-images/candidates/${encodedWord}?page=${page}&perPage=${perPage}`)
  },

  confirmWordImage(word, candidateId) {
    return jsonRequest(
      `/admin/word-images/confirm/${encodeURIComponent(word)}`,
      'POST',
      { candidateId },
    )
  },

  getWordImageUrl(word, refreshKey = 0) {
    return `${joinServicePath(FAMILY_WAR_API_BASE, `/images/${encodeURIComponent(word)}`)}?t=${refreshKey}`
  },
}
