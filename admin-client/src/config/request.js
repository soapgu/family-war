export class ApiRequestError extends Error {
  constructor(message, { status = null, cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function readResponseBody(response) {
  if (typeof response.text !== 'function') {
    return typeof response.json === 'function' ? response.json().catch(() => null) : null
  }
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function requestJson(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch (cause) {
    throw new ApiRequestError('网络连接失败，请稍后重试', { cause })
  }

  const body = await readResponseBody(response)
  if (!response.ok) {
    throw new ApiRequestError(body?.error || `请求失败（${response.status}）`, {
      status: response.status,
    })
  }

  return body
}
