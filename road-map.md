# Family War 路线图

> 更新日期：2026-07-24
>
> 本文记录 `family-war` 已完成的主要版本，以及管理端独立和平台化的后续小版本规划。具体实现细节以对应版本的设计文档和实施计划为准。

## 版本总览

| 版本 | 状态 | 主题 |
|---|---|---|
| v1.0 | 已发布 | 石头剪刀布与家庭房间对战 |
| v2.0 | 已完成 | 算术达人与多游戏模式架构 |
| v2.1 | 已发布 | `/family-war/` 子路径和预发布部署 |
| v2.2 | 已发布 | CRA 迁移至 Vite，Node.js 运行环境升级 |
| v3.0 | 已完成 | 英文默写、词库和图片管理 |
| v3.1 | 已发布 | 服务端重构、安全加固、断线恢复和自动化验收 |
| v3.2 | 已发布 | 独立 `admin-client` 与 `/admin/` 管理入口 |
| v3.3 | 已完成 | 公网 API 与 Socket.IO 路径规范化 |
| v3.4 | 规划中 | 平台管理框架完善 |
| v3.5 | 规划中 | 管理员认证解耦与旧入口清理 |
| 后续大版本 | 远期规划 | 平台普通用户、家庭档案与微信认证 |

## 已完成版本

### v1.0：家庭石头剪刀布

- 建立 React、Koa 和 Socket.IO 的前后端项目结构；
- 支持玩家进入默认房间、选择家庭角色和实时同步房间状态；
- 实现石头剪刀布开局、出拳、判定、计分、赛果和重赛；
- 加入机器人玩家、背景音乐、交互音效和动画；
- 提供基础后台状态页面和对局历史接口；
- 建立服务端单元测试和 Socket.IO 集成测试。

### v2.0：算术达人

- 增加全员参与的算术抢答模式；
- 服务端支持按 `gameType` 分发不同游戏逻辑；
- 增加题目生成、倒计时、实时排名、答题反馈和终局回放；
- 扩展机器人自动答题能力；
- 重构比赛结果组件，为继续增加游戏类型保留扩展点。

### v2.1：子路径部署

- 将生产页面部署到 `/family-war/`；
- 配置前端路由、静态资源、HTTP API 和 Socket.IO 的子路径访问；
- 增加 PM2 预发布服务配置；
- 补充 Nginx 反向代理和本地预发布环境说明。

### v2.2：前端工具链升级

- 从 Create React App 迁移到 Vite；
- JSX 源文件统一使用 `.jsx`；
- 客户端测试从 Jest 迁移到 Vitest；
- Node.js 运行环境从 16 升级到 24；
- 保持 `/family-war/` 生产部署路径和 `client/build/` 构建目录不变。

### v3.0：爱拼才会赢

- 增加英文默写模式和难度配置；
- 建立按章节组织的结构化词库；
- 增加英文发音、图片提示和 Unsplash 图片同步；
- 增加词库启用配置、缺失图片同步和手动候选图片选择；
- 扩展管理页面和服务端管理接口；
- 补充默写模式的客户端、服务端和集成测试。

### v3.1：稳定性与安全性

- 重构服务端游戏管理、机器人调度和定时任务边界；
- 统一游戏倒计时和机器人延迟配置；
- 增加管理员登录、JWT Cookie、登录限流和请求来源校验；
- 加固候选图片、分页参数和图片替换接口；
- 改善 Socket.IO 断线重连后的房间恢复和残留状态清理；
- 增加真实浏览器验收自动化及失败诊断；
- 统一服务端日志输出。

## 小版本路线

### v3.2：独立 `admin-client` 与管理入口（已完成）

#### 目标

将管理页面从游戏客户端中拆出，建立独立的 `admin-client` 前端项目和 `/admin/` 静态站点。该版本不修改后端业务代码、后端路由规则和现有认证协议；Nginx 只增加管理端静态文件与 SPA 回退配置。

目标目录：

```text
family-war/
├── client/          # 游戏前端
├── admin-client/    # 管理前端
├── server/          # family-war 后端
└── package.json     # 统一开发、测试和构建编排
```

#### 主要工作

- 将 `Admin`、`WordConfig`、`RequireAuth` 及相关测试迁入 `admin-client`；
- 从游戏 `client` 删除管理路由和管理端专用代码；
- 管理端不引入 `socket.io-client`，打开管理页面不再建立 Socket.IO 连接；
- 为管理端建立面向多应用的模块目录，现阶段只包含 `family-war`；
- 根项目增加管理端开发、测试和构建命令；
- 将只覆盖管理员页面的 Playwright 验收套件、恢复机制和依赖从 `server` 整体迁入 `admin-client`；
- 将管理页面地址与 API 地址拆成独立验收配置，删除管理验收未使用的 Socket.IO 配置；
- 保留现有管理员密码、`admin_token` Cookie 和管理 API；
- 更新 README、测试说明和验收自动化。

#### 独立部署方案

管理端从 v3.2 起使用独立页面入口：

```text
/admin/
/admin/family-war/
/admin/family-war/word-config
```

游戏端和管理端分别构建：

```text
client/build/
admin-client/build/
```

Nginx 增加独立 `/admin/` location，并将 Browser Router 的未知页面路径回退到管理端入口：

```nginx
location = /admin {
    return 302 /admin/;
}

location /admin/ {
    alias /Users/guhui/Githubs/family-war/admin-client/build/;
    index index.html;
    try_files $uri $uri/ /admin/index.html;
}
```

实施时必须通过实际环境验证 `alias` 和 `try_files` 的路径解析。管理页面虽然独立部署，管理 API 在 v3.2 仍继续使用现有公网路径：

```text
/family-war/api/admin/*
```

#### 验收重点

- 游戏端和管理端可以分别开发、测试和构建；
- `/family-war/` 游戏功能不受影响；
- `/admin/` 可以完成登录、状态查看和词库管理；
- `/admin/family-war/word-config` 等深层路由可以直接刷新；
- 打开管理端不会产生 Socket.IO 请求；
- Playwright 管理验收可从 `admin-client` 独立运行，失败或中断后仍能恢复服务端测试配置和词库/图片数据；
- 两个前端的构建目录互相独立；
- 后端代码和内部路由没有变化；
- Nginx 只新增 `/admin/` 静态站点，原游戏、API 和 Socket.IO location 行为不变。

### v3.3：公网资源路径规范化（已完成）

#### 目标

落实页面、HTTP API 和实时连接分区，统一 `family-war` 的公网资源路径，同时暂不修改 Koa 内部路由。

目标路径：

```text
游戏页面：    /family-war/
管理页面：    /admin/
HTTP API：    /api/family-war/
Socket.IO：   /socket/family-war/
```

#### 主要工作

- 修改 Nginx，新增 `/api/family-war/` 和 `/socket/family-war/` 代理；
- 分离游戏前端的 `PUBLIC_BASE`、`API_BASE` 和 `SOCKET_PATH`；
- 将管理端 API Base 切换到 `/api/family-war`；
- 修正服务端相对图片地址在前端的拼接逻辑；
- 同时验证 Socket.IO HTTP 长轮询和 WebSocket 升级；
- 在兼容期内暂时保留旧公网 API 和 Socket.IO 路径；
- Koa 内部继续使用 `/api/*` 和 `/socket.io/`。

#### 兼容观察

- 旧 `/family-war/api/*` 与 `/family-war/socket.io/*` 在 v3.3 中继续直接代理，不使用重定向；
- 旧入口写入独立的非敏感访问日志，用于区分真实客户端、监控和扫描流量；
- v3.3 不删除兼容入口；至少经过一个完整版本观察周期且确认没有真实客户端后，才能在后续版本提出下线；
- Socket.IO 旧入口下线时不得使用普通 HTTP 301/302 代替客户端升级。

详细路由原则参见 [`docs/ROUTING-MIGRATION-PLAN.md`](docs/ROUTING-MIGRATION-PLAN.md)。

### v3.4：平台管理框架完善

#### 目标

在 v3.2 已经独立部署的 `admin-client` 基础上，完善可承载整个应用体系管理功能的平台框架。

目标页面：

```text
/admin/                          管理首页
/admin/family-war/               family-war 状态
/admin/family-war/word-config    family-war 词库管理
```

#### 主要工作

- 建立平台管理布局、导航和应用模块入口；
- 将现有功能收拢到 `modules/family-war`；
- 为后续应用管理模块定义统一的路由、服务配置和错误处理约定；
- 根据访问日志决定是否为旧 `/family-war/admin` 增加或移除兼容跳转；
- 管理业务 API 仍由各应用自己的后端提供，不建立直接读取所有应用内部状态的集中式管理后端。

### v3.5：管理员认证解耦与旧入口清理

#### 目标

完成后台管理员身份解耦，并在兼容观察门槛满足后清理 v3.2 旧公网入口；不在本轮实现微信登录、家庭成员、儿童档案或普通游戏用户认证。

建议将管理员身份接口与应用管理接口分开：

```text
POST /api/admin-auth/login
GET  /api/admin-auth/me
POST /api/admin-auth/logout

GET  /api/family-war/admin/overview
GET  /api/family-war/admin/word-config
POST /api/family-war/admin/word-config
```

#### 主要工作

- 汇总 v3.3—v3.4 兼容日志，排除验收脚本、监控和扫描流量，形成旧入口下线依据；
- 在确认没有真实旧客户端后，删除 Nginx `/family-war/api/*` 兼容入口；
- 在确认没有真实旧客户端后，删除 Nginx `/family-war/socket.io/*` 兼容入口，且不使用 301/302；
- 删除网关验收中的旧入口“必须可用”断言，改为确认旧入口不可用、标准入口继续正常；
- 保留前端回滚方案的构建产物，但明确 v3.5 发布后回滚到 v3.2 需要同时恢复旧 Nginx location；
- 增加独立的管理员登录状态接口，不再使用业务状态接口探测登录状态；
- 管理端通过认证服务封装调用登录、查询当前管理员和退出；
- 使用独立命名的管理员 Session Cookie；
- 完善 Cookie 安全属性、登录限流、会话失效和请求来源校验；
- 根据实际管理员数量，决定继续使用单一管理密码，或引入管理员账号和密码哈希；
- 为未来多管理员预留启用、禁用、审计及应用权限能力；
- 权限概念可预留为 `family-war:view`、`family-war:word-config`、`family-war:image-manage`，但不强制在本版本实现完整 RBAC。

## 远期规划：平台普通用户认证

微信认证不属于 v3.2—v3.5 管理端迁移的交付范围。待统一入口、家庭体系和跨应用身份需求明确后，再以较大的独立版本规划：

- 微信或其他第三方登录；
- 平台普通用户 Session；
- 家庭关系和儿童档案；
- 当前活动档案选择；
- 应用访问授权；
- Socket.IO 用户身份验证；
- 游戏角色与真实身份的映射。

设计上始终区分三类概念：

```text
管理员身份：是否能够进入后台，以及可以管理哪些应用
平台身份：当前用户、所属家庭和活动档案
游戏角色：爸爸、妈妈、儿子、机器人
```

管理员会话与未来的平台用户会话应使用不同 Cookie 名称，前端业务页面不得直接依赖 JWT 内容或具体登录方式。

## 规划原则

- 小版本一次解决一个主要边界，避免将前端拆分、路由迁移和身份系统重构绑在同一次发布；
- 公网页面路径、API 路径和 Socket.IO 路径分别配置，不再互相推导；
- 管理前端属于平台，各应用的管理业务能力仍由各应用后端负责；
- 新旧路径只在迁移期并存，稳定后应删除兼容入口；
- 每个版本都必须同步更新单元测试、集成测试、浏览器验收和部署文档；
- 微信认证等远期能力只预留清晰边界，不提前增加当前版本的实现复杂度。
