# v3.5 管理员认证契约

冻结日期：2026-07-27  
适用阶段：v3.5 Phase 1—Phase 6

## 1. v3.4 现状盘点

当前认证由 family-war 管理模块承担：

| 能力 | v3.4 内部路由 | 当前行为 |
|------|---------------|----------|
| 登录 | `POST /api/admin/login` | 校验单一管理密码，签发 24 小时 JWT，设置 `admin_token` |
| 会话探测 | `GET /api/admin/status` | 验证 Cookie 的同时读取房间和对局历史 |
| 退出 | `POST /api/admin/logout` | 幂等删除 `admin_token` |
| 登录限流 | `POST /api/admin/login` | 同一 IP 1 分钟内 5 次失败后返回 429 |
| 来源校验 | `/api/admin*` 的非登录 POST | 生产模式下 Origin 与 Host 不一致返回 403 |
| 业务授权 | `/api/admin*` | 验证 `admin_token` 中 `role === "admin"` |

管理端的 `RequireAdminAuth` 通过 family-war `getStatus()` 探测会话，登录和退出方法也由
`modules/family-war/api.js` 导出。这使平台身份依赖房间状态和业务模块公开接口。

现有失败语义已经覆盖：

- 缺少 Cookie：401 `未登录`；
- 错误密码：401 `密码错误`；
- 过期 JWT：401 `登录已过期`；
- 篡改 JWT：401 `登录已失效`；
- 错误角色：401 `无效的登录状态`；
- 跨源修改请求：403 `拒绝的请求来源`；
- 登录失败达到门槛：429 `登录尝试过于频繁，请稍后再试`。

## 2. v3.5 接口契约

### `POST /api/admin-auth/login`

请求：

```json
{ "password": "管理密码" }
```

成功：HTTP 200，设置 `admin_session`，响应：

```json
{ "success": true }
```

失败：

| 状态 | 响应 | 场景 |
|------|------|------|
| 400 | `{"error":"请输入管理密码"}` | password 缺失、不是字符串或为空 |
| 401 | `{"error":"密码错误"}` | 密码不匹配 |
| 403 | `{"error":"拒绝的请求来源"}` | 生产环境跨源请求 |
| 429 | `{"error":"登录尝试过于频繁，请稍后再试"}` | 同一 IP 在窗口内达到失败门槛 |
| 503 | `{"error":"管理员认证未配置"}` | 非生产环境缺少管理员密码或 JWT Secret |

生产环境缺少管理员密码或 JWT Secret 时，服务端必须在启动阶段失败，不开放一个允许任意
密码登录的实例。开发和测试环境不得把临时 Secret 写入日志；若配置缺失，认证接口返回
503，不能继续沿用 v3.4 的“空密码接受任意输入”行为。

### `GET /api/admin-auth/me`

成功：HTTP 200：

```json
{
  "authenticated": true,
  "admin": {
    "id": "admin",
    "role": "admin",
    "displayName": "管理员"
  }
}
```

该接口不得读取房间、比赛、词库或图片状态。

失败：

| 状态 | 响应 | 场景 |
|------|------|------|
| 401 | `{"error":"未登录"}` | 缺少 Cookie |
| 401 | `{"error":"登录已过期"}` | JWT 已过期 |
| 401 | `{"error":"登录已失效"}` | JWT 签名或结构无效 |
| 401 | `{"error":"无效的登录状态"}` | role、tokenType、audience、issuer 或 subject 不匹配 |

### `POST /api/admin-auth/logout`

无论 Cookie 是否存在或是否有效，都幂等清除 `admin_session` 并返回 HTTP 200：

```json
{ "success": true }
```

生产环境跨源请求仍返回 403。退出不要求先通过 JWT 验证，保证损坏或过期 Cookie 也能被
浏览器清除。

## 3. Cookie 契约

| 属性 | 冻结值 |
|------|--------|
| 名称 | `admin_session` |
| 传输 | 只通过 Set-Cookie/Cookie，不出现在 JSON、URL 或 Web Storage |
| HttpOnly | `true` |
| SameSite | `Lax` |
| Path | `/` |
| Max-Age | 86400 秒 |
| Secure | 请求经 HTTPS 到达时启用；本机 HTTP 预发布不启用 |
| 删除 | 使用与签发相同的 Path、SameSite、HttpOnly、Secure，Max-Age 为 0 或负值 |

v3.5 不兼容读取 `admin_token`，升级后管理员需要重新登录。认证回滚时恢复 v3.4
服务端和管理端即可，不转换两种 Cookie。

## 4. JWT 契约

管理员 JWT 继续使用现有 `config.auth.jwtSecret`，冻结声明如下：

| 声明 | 值 |
|------|----|
| `sub` | `admin` |
| `role` | `admin` |
| `tokenType` | `admin-session` |
| `aud` | `admin-client` |
| `iss` | `family-war-admin-auth` |
| `exp` | 签发后 24 小时 |

认证中间件必须同时验证签名、有效期和以上声明。未来微信或平台普通用户身份不得直接复用
`admin_session`、`tokenType`、受众或管理员验证中间件；届时再决定使用独立 Secret
还是独立签发服务。

## 5. 自动化边界

Phase 1 使用 `server/src/auth/adminAuthContract.js` 和对应单元测试锁定路径、Cookie、
JWT 声明及成功响应。v3.4 现有测试继续作为迁移基线，覆盖错误密码、缺少 Cookie、
过期/篡改/错误角色 Token、跨源 POST 和限流。

Phase 2 实现新接口时，必须把上述基线迁移为对新路径和新 Cookie 的行为测试，并新增
错误 `tokenType`、audience、issuer、subject、空配置 503 和生产启动失败测试。
