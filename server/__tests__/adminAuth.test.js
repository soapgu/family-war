const request = require('supertest')
const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const jwt = require('jsonwebtoken')

const mockAuthConfig = { adminPassword: 'test123', jwtSecret: 'test-secret' }

const defaultGameConfig = {
  rps: { winningScore: 2 },
  arithmetic: { winningScore: 5, questionTimeLimitMs: 20000, robotAnswerDelayMs: 20000 },
  spelling: {
    winningScore: 5,
    difficulties: {
      easy: { questionTimeLimitMs: 40000, robotAnswerDelayMs: 40000 },
      normal: { questionTimeLimitMs: 30000, robotAnswerDelayMs: 30000 },
      hard: { questionTimeLimitMs: 20000, robotAnswerDelayMs: 20000 },
    },
  },
}

jest.mock('../config', () => ({
  get auth() { return { get adminPassword() { return mockAuthConfig.adminPassword }, get jwtSecret() { return mockAuthConfig.jwtSecret } } },
  unsplashAccessKey: 'test-key',
  unsplashPerPage: 10,
  games: defaultGameConfig,
  DEFAULT_GAME_CONFIG: defaultGameConfig,
}))

jest.mock('../src/data/wordBank', () => ({
  getAllWords: jest.fn(() => ['cat', 'dog', 'elephant']),
  getChapters: jest.fn(() => [{ chapter: 'Test', words: ['cat', 'dog', 'elephant'] }]),
  getConfig: jest.fn(() => ({ enabledChapters: ['Test'], disabledWords: [] })),
  setConfig: jest.fn(),
}))

const mockUnsplash = {
  getSyncStatus: jest.fn(() => ({ total: 0, synced: 0, pending: 0, words: [] })),
  getSyncRunning: jest.fn(() => false),
  syncAll: jest.fn(),
  syncMissing: jest.fn(),
  syncWord: jest.fn(),
  getImageUrl: jest.fn((w) => `/api/images/${w}`),
  searchCandidates: jest.fn(),
  consumeCandidate: jest.fn(),
  downloadImage: jest.fn(),
}

jest.mock('../src/unsplashClient', () => mockUnsplash)

function createApp() {
  const app = new Koa()
  const router = new Router()
  const { authMiddleware, originCheckMiddleware, loginRateLimitMiddleware, resetLoginAttempts } = require('../src/middleware/auth')
  const registerAdminRoutes = require('../src/routes/admin')

  resetLoginAttempts()

  router.get('/api/health', (ctx) => { ctx.body = { status: 'ok' } })

  app.proxy = true
  app.use(bodyParser())
  app.use(loginRateLimitMiddleware)
  app.use(originCheckMiddleware)
  app.use(authMiddleware)
  app.use(router.routes())
  app.use(router.allowedMethods())
  registerAdminRoutes(router)

  return app
}

function validToken() {
  return jwt.sign({ role: 'admin' }, 'test-secret', { expiresIn: '1h' })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthConfig.adminPassword = 'test123'
  mockAuthConfig.jwtSecret = 'test-secret'
  process.env.NODE_ENV = 'test'
})

describe('authMiddleware', () => {
  it('无 cookie 访问管理端点返回 401', async () => {
    const app = createApp()
    const res = await request(app.callback()).get('/api/admin/status')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: '未登录' })
  })

  it('有效 token 正常访问', async () => {
    const app = createApp()
    const res = await request(app.callback())
      .get('/api/admin/status')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(res.status).toBe(200)
  })

  it('login/logout 端点无需认证', async () => {
    const app = createApp()
    const loginRes = await request(app.callback()).post('/api/admin/login').send({ password: 'test123' })
    expect(loginRes.status).toBe(200)

    const logoutRes = await request(app.callback()).post('/api/admin/logout')
    expect(logoutRes.status).toBe(200)
  })

  it('非 /api/admin 路径不受影响', async () => {
    const app = createApp()
    const res = await request(app.callback()).get('/api/health')
    expect(res.status).toBe(200)
  })

  it('错误密码返回 401', async () => {
    const app = createApp()
    const res = await request(app.callback()).post('/api/admin/login').send({ password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: '密码错误' })
  })

  it('正确密码返回 200 并设置 cookie', async () => {
    const app = createApp()
    const res = await request(app.callback()).post('/api/admin/login').send({ password: 'test123' })
    expect(res.status).toBe(200)
    const cookie = res.headers['set-cookie']
    expect(cookie).toBeDefined()
    expect(cookie[0]).toMatch(/admin_token=.+;.*httponly/i)
  })

  it('dev 模式（空密码）任意密码返回 200', async () => {
    mockAuthConfig.adminPassword = ''
    const app = createApp()
    const res = await request(app.callback()).post('/api/admin/login').send({ password: 'anypassword' })
    expect(res.status).toBe(200)
  })

  it('过期 JWT 返回 401', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      const err = new Error('jwt expired')
      err.name = 'TokenExpiredError'
      throw err
    })
    const app = createApp()
    const res = await request(app.callback())
      .get('/api/admin/status')
      .set('Cookie', 'admin_token=expired')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: '登录已过期' })
  })

  it('篡改 JWT 返回 401', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw new Error('invalid signature')
    })
    const app = createApp()
    const res = await request(app.callback())
      .get('/api/admin/status')
      .set('Cookie', 'admin_token=tampered')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: '登录已失效' })
  })

  it('错误 role 返回 401', async () => {
    const badToken = jwt.sign({ role: 'user' }, 'test-secret', { expiresIn: '1h' })
    const app = createApp()
    const res = await request(app.callback())
      .get('/api/admin/status')
      .set('Cookie', `admin_token=${badToken}`)
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: '无效的登录状态' })
  })

  it('登出清除 cookie', async () => {
    const app = createApp()
    const res = await request(app.callback()).post('/api/admin/logout')
    expect(res.status).toBe(200)
    const cookie = res.headers['set-cookie']
    expect(cookie).toBeDefined()
    expect(cookie[0]).toMatch(/Max-Age=-1|expires=Thu, 01 Jan 1970/)
  })
})

describe('loginRateLimitMiddleware', () => {
  it('6 次失败后返回 429', async () => {
    mockAuthConfig.adminPassword = 'secret'
    const app = createApp()

    for (let i = 0; i < 5; i++) {
      const res = await request(app.callback()).post('/api/admin/login').send({ password: 'wrong' })
      expect(res.status).toBe(401)
    }

    const res = await request(app.callback()).post('/api/admin/login').send({ password: 'wrong' })
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: '登录尝试过于频繁，请稍后再试' })
  })
})

describe('originCheckMiddleware', () => {
  it('POST + Origin 不匹配返回 403', async () => {
    process.env.NODE_ENV = 'production'
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/logout')
      .set('Origin', 'http://evil.com')
      .set('Host', 'real-host.com')
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: '拒绝的请求来源' })
  })

  it('POST + Origin 匹配正常处理', async () => {
    process.env.NODE_ENV = 'production'
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/logout')
      .set('Origin', 'http://127.0.0.1')
      .set('Host', '127.0.0.1')
    expect(res.status).toBe(200)
  })

  it('NODE_ENV 非 production 跳过 Origin 校验', async () => {
    process.env.NODE_ENV = 'development'
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/logout')
      .set('Origin', 'http://evil.com')
      .set('Host', 'real-host.com')
    expect(res.status).toBe(200)
  })

  it('GET 请求不受 Origin 限制', async () => {
    process.env.NODE_ENV = 'production'
    const app = createApp()
    const res = await request(app.callback())
      .get('/api/admin/status')
      .set('Cookie', `admin_token=${validToken()}`)
      .set('Origin', 'http://evil.com')
    expect(res.status).toBe(200)
  })
})

describe('candidateId 机制', () => {
  it('confirm 缺少 candidateId 返回 400', async () => {
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/word-images/confirm/cat')
      .set('Cookie', `admin_token=${validToken()}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '缺少 candidateId' })
  })

  it('无效 candidateId 返回 400', async () => {
    mockUnsplash.consumeCandidate.mockReturnValue(null)
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/word-images/confirm/cat')
      .set('Cookie', `admin_token=${validToken()}`)
      .send({ candidateId: 'invalid-uuid' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '无效或已过期的 candidateId' })
  })

  it('有效 candidateId 成功下载', async () => {
    mockUnsplash.consumeCandidate.mockReturnValue('https://example.com/img.jpg')
    mockUnsplash.downloadImage.mockResolvedValue(true)
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/word-images/confirm/cat')
      .set('Cookie', `admin_token=${validToken()}`)
      .send({ candidateId: 'valid-uuid' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ word: 'cat', imageUrl: '/api/images/cat' })
    expect(mockUnsplash.consumeCandidate).toHaveBeenCalledWith('cat', 'valid-uuid')
    expect(mockUnsplash.downloadImage).toHaveBeenCalledWith('https://example.com/img.jpg', 'cat')
  })

  it('词库外的 word 返回 400', async () => {
    const app = createApp()
    const res = await request(app.callback())
      .post('/api/admin/word-images/confirm/notaword')
      .set('Cookie', `admin_token=${validToken()}`)
      .send({ candidateId: 'uuid' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '"notaword" 不在词库中' })
  })

  it('特殊字符 word 返回 400', async () => {
    const app = createApp()
    const res = await request(app.callback())
      .post(`/api/admin/word-images/confirm/${encodeURIComponent('../../etc')}`)
      .set('Cookie', `admin_token=${validToken()}`)
      .send({ candidateId: 'uuid' })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: '"../../etc" 不在词库中' })
  })

  it('candidates 端点返回 candidateId 而非 url', async () => {
    const app = createApp()
    mockUnsplash.searchCandidates.mockResolvedValue({
      candidates: [{ id: 'p1', candidateId: 'uuid-1', thumb: 'thumb.jpg', author: 'Tester', alt: 'test' }],
      total: 1,
      page: 1,
      perPage: 15,
    })
    const res = await request(app.callback())
      .get('/api/admin/word-images/candidates/cat')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.candidates[0]).not.toHaveProperty('url')
    expect(res.body.candidates[0]).toHaveProperty('candidateId')
    expect(res.body.candidates[0].thumb).toBe('thumb.jpg')
  })
})

describe('page/perPage 钳位', () => {
  it('page=0 钳位到 1', async () => {
    mockUnsplash.searchCandidates.mockResolvedValue({ candidates: [], total: 0 })
    const app = createApp()
    await request(app.callback())
      .get('/api/admin/word-images/candidates/cat?page=0')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(mockUnsplash.searchCandidates).toHaveBeenCalledWith('cat', 1, 15)
  })

  it('page=-5 钳位到 1', async () => {
    mockUnsplash.searchCandidates.mockResolvedValue({ candidates: [], total: 0 })
    const app = createApp()
    await request(app.callback())
      .get('/api/admin/word-images/candidates/cat?page=-5')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(mockUnsplash.searchCandidates).toHaveBeenCalledWith('cat', 1, 15)
  })

  it('perPage=0 钳位到 1', async () => {
    mockUnsplash.searchCandidates.mockResolvedValue({ candidates: [], total: 0 })
    const app = createApp()
    await request(app.callback())
      .get('/api/admin/word-images/candidates/cat?perPage=0')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(mockUnsplash.searchCandidates).toHaveBeenCalledWith('cat', 1, 1)
  })

  it('perPage=100 钳位到 30', async () => {
    mockUnsplash.searchCandidates.mockResolvedValue({ candidates: [], total: 0 })
    const app = createApp()
    await request(app.callback())
      .get('/api/admin/word-images/candidates/cat?perPage=100')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(mockUnsplash.searchCandidates).toHaveBeenCalledWith('cat', 1, 30)
  })

  it('非数字参数安全兜底', async () => {
    mockUnsplash.searchCandidates.mockResolvedValue({ candidates: [], total: 0 })
    const app = createApp()
    await request(app.callback())
      .get('/api/admin/word-images/candidates/cat?page=abc&perPage=xyz')
      .set('Cookie', `admin_token=${validToken()}`)
    expect(mockUnsplash.searchCandidates).toHaveBeenCalledWith('cat', 1, 15)
  })
})
