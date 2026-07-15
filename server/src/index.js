const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const cors = require('@koa/cors')
const { Server } = require('socket.io')
const http = require('http')
const path = require('path')
const fs = require('fs')
const registerHandlers = require('./socket/handler')
const registerAdminRoutes = require('./routes/admin')

const app = new Koa()
const router = new Router()

app.use(cors())
app.use(bodyParser())
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
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
