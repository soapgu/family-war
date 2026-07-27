# v3.5.0 版本发布报告

执行时间：2026-07-27

## 发布范围

v3.5.0 完成管理员认证解耦与 v3.2 旧公网入口清理：

- 管理员身份接口迁移到 `/api/admin-auth/login|me|logout`；
- 使用管理员专用 `admin_session` HttpOnly Cookie；
- family-war 管理接口只保留业务职责；
- 管理端认证与 family-war 业务请求使用独立服务边界；
- 删除 `/family-war/api/*` 和 `/family-war/socket.io/*` Nginx location；
- 保留未启用的旧 location 回滚片段。

本版本不包含微信登录、普通用户身份、家庭档案、多管理员账号或完整 RBAC。

## 最终自动化门禁

| 项目 | 结果 |
|------|------|
| 服务端 Jest | 11 个测试套件、273 项测试通过 |
| 游戏端 Vitest | 10 个测试文件、87 项测试通过 |
| 管理端 Vitest | 14 个测试文件、59 项测试通过 |
| Socket.IO 集成测试 | 95 项断言通过 |
| 管理端 acceptance 离线检查 | 7 个步骤通过 |
| 网关验收离线检查 | 认证、标准路径、双传输和旧入口模式通过 |
| 游戏端 E2E 清单 | 2 个文件、8 项测试可发现 |
| 完整生产构建 | 通过 |
| 构建隔离验证 | 通过 |

单元测试中的既存 jsdom `getComputedStyle` 和 React `act` 提示不影响测试结果；两个前端
生产构建的单 chunk 超过 500 kB 提示不影响产物生成。

## 预发布发布依据

当前没有独立正式环境，因此跳过正式环境部署、正式流量观察和线上重复验收。发布批准
依据为本机预发布 Phase 5 的完整结果：

- 管理端 Playwright acceptance 在切换前后均为 7/7 通过；
- 游戏端 Playwright E2E 为 8/8 通过；
- `compatible` 和 `removed` 两种真实 Nginx 网关验收通过；
- 标准 API、图片、Socket.IO polling-only 和 WebSocket-only 通过；
- 旧 API 不再代理或重定向；
- 旧 Socket.IO polling/WebSocket 均不可连接且没有 301/302；
- 管理员 Cookie 属性、刷新保持、登出、401、限流及恢复通过；
- Nginx 生效配置与版本化配置一致，PM2 最终在线；
- Acceptance 临时认证配置、词库和图片数据均已恢复。

详细证据见 `docs/acceptance/v3.5/phase-5-report.md`。

## 回滚资产

- 旧入口回滚片段继续保留在 `deploy/nginx/family-war-legacy-locations.conf`；
- 旧入口单独恢复、兼容验证和重新下线演练通过；
- v3.4 服务端、管理端构建和浏览器 `admin_token` 登录回滚演练通过；
- 恢复 v3.5 后 `admin_session` 生效，旧认证接口返回 404，无迁移残留；
- Phase 5 临时 v3.4 副本已删除，不属于长期回滚资产；
- 完整回滚步骤见 `docs/acceptance/v3.5/rollback.md`。

## 升级说明

- 管理员升级后需要重新登录，旧 `admin_token` 不转换为 `admin_session`；
- 仍使用 v3.2 旧公网路径的客户端将无法访问；
- 如确认存在旧客户端，只恢复两个旧 Nginx location，不需要回滚 v3.5 管理员认证；
- 如新管理员认证异常，服务端和管理端必须配套回滚到 v3.4；
- 本版本无数据库迁移或数据格式转换。

## 发布结论

版本号、代码、自动化、Nginx 最终配置、回滚说明和发布文档一致，满足 v3.5.0 发布条件。
正式环境步骤因没有独立正式环境而明确跳过，不将本机预发布描述为正式环境。
