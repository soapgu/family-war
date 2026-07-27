const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const { Server } = require('socket.io')
const http = require('http')
const path = require('path')
const fs = require('fs')
const logger = require('./logger')
const registerHandlers = require('./socket/handler')
const registerAdminAuthRoutes = require('./routes/adminAuth')
const registerAdminRoutes = require('./routes/admin')
const {
  authMiddleware,
  originCheckMiddleware,
  loginRateLimitMiddleware,
  assertAdminAuthConfig,
  startCleanup,
} = require('./middleware/auth')

const app = new Koa()
app.proxy = true
const router = new Router()

app.use(bodyParser())
app.use(loginRateLimitMiddleware)
app.use(originCheckMiddleware)
app.use(authMiddleware)
app.use(router.routes())
app.use(router.allowedMethods())

const server = http.createServer(app.callback())
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

// Health check
router.get('/api/health', (ctx) => {
  ctx.body = { status: 'ok' }
})

// Socket 事件注册
registerHandlers(io)

// 平台管理员身份
registerAdminAuthRoutes(router)

// 管理接口
registerAdminRoutes(router)

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images')

/** 提供本地图片文件 */
router.get('/api/images/:name', (ctx) => {
  const name = ctx.params.name
  if (!/^[\w\s.-]+$/.test(name)) {
    ctx.status = 400
    ctx.body = { error: '无效的文件名' }
    return
  }

  const baseName = name.replace(/\.jpg$/, '')
  const filePath = path.join(IMAGES_DIR, `${baseName}.jpg`)
  if (!fs.existsSync(filePath)) {
    ctx.status = 404
    ctx.body = { error: '图片不存在' }
    return
  }

  ctx.type = 'image/jpeg'
  ctx.body = fs.createReadStream(filePath)
})

const PORT = process.env.PORT || 4000
assertAdminAuthConfig()
server.listen(PORT, () => {
  startCleanup()
  logger.info(`Server running on http://localhost:${PORT}`)
})
