const Koa = require('koa')
const Router = require('@koa/router')
const cors = require('@koa/cors')
const { Server } = require('socket.io')
const http = require('http')
const registerHandlers = require('./socket/handler')

const app = new Koa()
const router = new Router()

app.use(cors())
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

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
