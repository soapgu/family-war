# Family War Client

Family War 的 React 客户端，使用 Vite、Ant Design、Socket.IO Client 和 Vitest。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm start` | 启动 Vite 开发服务器，默认端口 3000 |
| `npm run build` | 构建生产产物到 `build/` |
| `npm run preview` | 本地预览生产构建 |
| `npm test` | 单次运行全部 Vitest 测试 |
| `npm run test:watch` | 以监听模式运行 Vitest |

开发环境下，Vite 将 `/api` 和 `/socket.io` 代理到 `http://localhost:4000`。生产构建使用 `/family-war/` 作为基础路径。

完整架构、玩法和部署说明见项目根目录 [`README.md`](../README.md)，开发进度见 [`step.md`](../step.md)。
