# v3.4 Phase 5 自动化验收与兼容观察报告

执行时间：2026-07-26  
预发布环境：本机 Nginx `http://localhost:8080`、PM2 `family-war-server`

## 自动化结果

| 项目 | 结果 |
|------|------|
| 管理端 Vitest | 13 个测试文件、54 项测试通过 |
| acceptance 离线检查 | 7 个浏览器步骤及网络边界检查通过 |
| 管理端生产构建 | 通过 |
| 双前端构建隔离 | 游戏端和管理端可独立、重复构建 |
| Playwright 预发布 acceptance | 7/7 通过 |
| 数据恢复 | 临时管理员密码、词库配置和替换图片均已恢复 |
| 新旧网关兼容 | API、Socket.IO 双传输和图片链路全部通过 |

Playwright 覆盖：

- 管理员登录、错误密码、Cookie、登出、401 后重新登录；
- 平台首页应用卡片、注册表导航及模块导航选中状态；
- Family War 状态、词库开关、保存、刷新和数据恢复；
- 图片候选、确认替换、文件哈希变化及原图哈希恢复；
- 管理首页、模块页和词库页的面包屑；
- 浏览器前进后退、词库深层链接刷新和明确的 404 页面；
- 1366×768、1440×900、1920×1080 桌面布局；
- 管理端只请求 `/api/family-war/*`，未请求 Socket.IO 或旧 API。

首次执行时，新增平台步骤因测试把 Ant Design 卡片标题错误识别为语义化
`heading` 而失败；业务页面已正常渲染。将 Page Object 改为按应用卡片容器和可见
文本定位后续跑通过。补充 TTS 浏览器断言后，无头 Chromium 因缺少
`SpeechSynthesisUtterance` 首次走入“不支持语音”分支；在测试上下文补齐标准语音
对象后，验证目标单词、`en-GB` 和语速 `0.8` 全部通过。两次失败后的配置和词库数据
均由恢复流程还原。

## 网关兼容验证

`GATEWAY_BASE_URL=http://localhost:8080 npm run test:gateway` 通过：

- `/api/family-war/health` 与 `/family-war/api/health` 均返回 200，响应一致且无重定向；
- `/socket/family-war/` 的 polling-only、WebSocket-only 均能连接并完成事件往返；
- `/family-war/socket.io/` 的 polling-only、WebSocket-only 均能连接并完成事件往返；
- 默写图片可通过 `/api/family-war/images/*` 获得 200 和图片 Content-Type；
- v3.4 仍保留旧 API 与 Socket.IO Nginx location。

`nginx -t` 通过，验收完成并恢复配置后 PM2 `family-war-server` 状态为 `online`。

## v3.3—v3.4 兼容日志观察

日志文件：

`/opt/homebrew/var/log/nginx/family-war-legacy-access.log`

统计时点共有 57 行：

| 日期 | 行数 | 判断 |
|------|------|------|
| 2026-07-24 | 46 | v3.3 发布、回滚和网关验收流量 |
| 2026-07-26 | 11 | 本报告执行的新旧网关兼容测试 |

路径汇总：

- 旧 API `/family-war/api/health`：7 次；
- 旧 Socket.IO `/family-war/socket.io/`：50 次。

来源全部为回环地址 `127.0.0.1`。User-Agent 仅有 `curl/8.7.1`、`node`、
`node-XMLHttpRequest` 和 WebSocket 空值，与发布、验收和自动化脚本特征一致。
排除这些流量后，没有发现浏览器或其他真实旧客户端访问。

## v3.5 清理结论

v3.3 和 v3.4 两个观察周期均未发现真实旧客户端，已经满足“无真实兼容入口访问”
这一清理前提。可以在 v3.5 按既定计划移除旧 API 与 Socket.IO location。

执行 v3.5 清理前仍需：

1. 再做一次清理时点日志增量检查；
2. 备份 Nginx 配置并执行 `nginx -t`；
3. 删除旧 location 后运行标准入口网关测试；
4. 保留可快速恢复旧 location 的回滚配置。
