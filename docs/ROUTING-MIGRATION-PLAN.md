# 多应用平台路由改造方案

> 状态：v3.3 已完成公网路径规范化；统一认证与旧入口下线仍属后续规划
>
> 适用项目：`family-war` 及未来的统一学习平台
>
> 文档目标：定义统一入口、子应用、HTTP API、Socket.IO 和统一认证的长期路由规范，并给出可渐进实施的迁移方案。

## 1. 背景

未来计划将多个寓教于乐的 Web 应用部署在同一个域名下，由一个统一入口应用负责应用导航和用户身份认证。例如：

- 总入口：展示可用的学习、游戏应用；
- `family-war`：家庭互动游戏；
- `that-math-things`：纯前端数学学习应用；
- 未来可能增加识字、英语等子应用。

v3.2 及更早版本中，浏览器访问的 API 和 Socket.IO 路径分别带有相同的应用前缀：

```text
/family-war/api/admin/status
/family-war/socket.io
```

服务端内部仍使用：

```text
/api/admin/status
/socket.io
```

当前结构可以工作，但当子应用数量增加后，页面、HTTP API 和实时连接的路径职责会混在一起，不利于统一管理和网关配置。

## 2. 改造目标

采用按资源类型划分的统一公网路由：

```text
前端页面：/{app}/
HTTP API：/api/{app}/
实时连接：/socket/{app}/
平台认证：/api/auth/
```

目标路由示例：

| 用途 | 目标公网路径 |
|---|---|
| 平台总入口 | `/` |
| `family-war` 前端 | `/family-war/` |
| `that-math-things` 前端 | `/that-math-things/` |
| 平台统一认证 | `/api/auth/` |
| 平台用户档案 | `/api/profile/` |
| `family-war` API | `/api/family-war/` |
| `family-war` Socket.IO | `/socket/family-war/` |

该方案只规范公网访问路径。各子应用的内部路由可以暂时保持不变，由 Nginx 完成转换。`that-math-things` 是纯前端应用，因此不为它预留 `/api/that-math-things/`；只有实际包含后端服务的子应用才需要 `/api/{app}/` 命名空间。

## 3. 设计原则

### 3.1 页面、API、实时连接分区

- `/{app}/` 只负责前端页面和静态资源；
- `/api/{app}/` 只负责包含后端服务的子应用 HTTP API；
- `/socket/{app}/` 只负责 WebSocket 或 Socket.IO；
- `/api/auth/` 是平台级能力，不属于任何单独子应用。

### 3.2 子应用拥有独立命名空间

不同的后端应用可以拥有相同的内部业务路由，不会在公网发生冲突：

```text
/api/family-war/admin/status
/api/future-app/admin/status
```

### 3.3 统一身份不通过 URL 传递

统一入口完成登录后，通过作用域为 `/` 的安全 Session Cookie 保存会话。禁止在查询参数、URL 或 `localStorage` 中传递 `openid`、用户 ID 或长期登录令牌。

建议 Cookie 属性：

```text
Path=/
HttpOnly
Secure
SameSite=Lax
```

各子应用通过 `/api/auth/me` 查询当前账户和活动档案；需要强制登录的后端接口必须自行验证会话，不能只依赖前端判断。

### 3.4 公网路径与服务内部路径解耦

第一阶段不批量修改 Koa 内部路由和既有测试。Nginx 将规范的公网路径转换为服务当前使用的内部路径。

示例：

```text
公网：GET /api/family-war/admin/status
内部：GET /api/admin/status
```

## 4. Nginx 目标映射

以下配置仅表达目标结构，实施时需要结合实际域名、构建目录、端口和现有公共配置调整。

```nginx
server {
    listen 443 ssl;
    server_name kids.example.com;

    # 平台总入口
    location / {
        root /var/www/main-page;
        try_files $uri $uri/ /index.html;
    }

    # family-war 前端
    location /family-war/ {
        alias /var/www/family-war/client/build/;
        try_files $uri $uri/ /family-war/index.html;
    }

    # that-math-things 纯前端应用；保持当前部署路径和构建目录
    location = /that-math-things {
        return 302 /that-math-things/;
    }

    location /that-math-things/ {
        alias /Users/guhui/Githubs/that-math-things/build/;
        index index.html;
    }

    # 平台统一认证
    location /api/auth/ {
        proxy_pass http://127.0.0.1:4100/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # family-war API：移除公网的应用命名空间，保留内部 /api 前缀
    location /api/family-war/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # family-war Socket.IO
    location /socket/family-war/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

实施前必须用实际 Nginx 配置验证 `alias`、`try_files` 和 `proxy_pass` 尾部斜杠的重写行为，避免路径被重复拼接或错误截断。

当前本机的 `that-math-things` 配置已经符合目标路径规划，可原样保留：

```nginx
location = /that-math-things {
    return 302 /that-math-things/;
}

location /that-math-things/ {
    alias /Users/guhui/Githubs/that-math-things/build/;
    index index.html;
}
```

它只提供前端静态文件，不参与本次 API 路由迁移。将来如果该应用出现浏览器端路由刷新 404，再根据它实际采用的路由模式评估是否增加 `try_files` 回退，当前方案不预先改变其行为。

## 5. `family-war` 改造范围

### 5.1 前端页面路径

保持现状：

```text
Vite base：/family-war/
React Router basename：/family-war
```

页面路由不需要因 API 规范化而迁移。

### 5.2 HTTP API

v3.2 公网路径（v3.3 兼容入口）：

```text
/family-war/api/admin/status
```

v3.3 标准公网路径：

```text
/api/family-war/admin/status
```

服务端内部第一阶段继续保留：

```text
/api/admin/status
```

前端应将“页面 Public Base”和“API Base”彻底分离，避免继续通过同一个 `/family-war` 前缀推导 API 地址。

建议概念：

```js
PUBLIC_BASE = '/family-war/'
API_BASE = '/api/family-war'
```

调用目标形式：

```js
fetch(`${API_BASE}/admin/status`)
```

### 5.3 Socket.IO

v3.2 公网路径（v3.3 兼容入口）：

```text
/family-war/socket.io
```

v3.3 标准公网路径：

```text
/socket/family-war/
```

客户端目标配置：

```js
io('/', {
  path: '/socket/family-war/'
})
```

服务端可以继续监听默认内部路径 `/socket.io/`，由 Nginx 转换。实施时必须验证握手、轮询降级和 WebSocket 升级均正常。

### 5.4 图片资源 API

当前服务端会生成 `/api/images/:name` 形式的相对路径。迁移后，浏览器实际访问地址应为：

```text
/api/family-war/images/:name
```

实施时需要统一处理服务端返回值和前端 URL 拼接，避免图片仍请求根路径 `/api/images/...`。

## 6. 统一认证衔接

平台认证服务建议提供：

```text
GET  /api/auth/wechat
GET  /api/auth/wechat/callback
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/profile/select
```

`family-war` 后端需要增加平台会话验证，但可以暂时保留现有管理员密码认证。两类身份应明确区分：

- 平台会话：识别微信账户、家庭和当前活动档案；
- 应用权限：判断当前档案是否可以进入游戏或执行管理操作。

后期再决定是否将现有 `/api/admin/login` 管理员密码机制合并到平台权限模型中，不将其列为本次路由迁移的强制前置任务。

Socket.IO 握手也必须验证平台会话，并以服务端得到的用户或档案 ID 为准，不能相信客户端直接提交的身份信息。

## 7. 渐进迁移计划

### 阶段一：准备与兼容

1. 确定正式域名、应用名称和统一路由规范；
2. 建立 Main Page 和认证服务的部署位置；
3. 在 Nginx 中新增目标 API、Socket 路径；
4. 暂时保留旧路径，避免一次性切断现有访问；
5. 为旧路径增加访问日志，用于判断是否仍有客户端使用。

兼容期内可同时支持：

```text
旧：/family-war/api/*
新：/api/family-war/*
```

两个路径均代理到同一个 Koa 服务。

### 阶段二：客户端迁移

1. 分离 `PUBLIC_BASE`、`API_BASE` 和 `SOCKET_PATH`；
2. 将全部 HTTP 请求切换到 `/api/family-war/*`；
3. 将 Socket.IO 切换到 `/socket/family-war/`；
4. 修正图片及其他服务端返回的相对资源地址；
5. 更新客户端单元测试和生产构建说明。

### 阶段三：统一认证接入

1. Main Page 完成登录并设置平台 Session Cookie；
2. `family-war` HTTP API 接入会话验证；
3. Socket.IO 握手接入会话验证；
4. 匿名功能和强制登录功能分别定义访问规则；
5. 明确微信账户、家庭档案、游戏角色三者的关系。

### 阶段四：移除旧路径

1. 确认访问日志中不再使用旧 API、Socket 路径；
2. 先将旧 HTTP API 返回迁移提示或临时重定向；
3. Socket.IO 旧路径不采用普通页面式重定向，客户端必须完成升级后再移除；
4. 删除旧 Nginx location；
5. 更新部署文档和运维检查项。

## 8. 兼容与风险

### 8.1 不建议长期双路径运行

长期同时暴露新旧 API 会扩大安全策略、限流和日志分析的覆盖范围。双路径只用于迁移期。

### 8.2 Cookie 路径

统一身份 Cookie 必须使用 `Path=/`。应用内部的管理 Cookie 应使用独立名称，并根据需求限制 Path，避免与平台 Session 混淆。

### 8.3 CSRF

统一 Cookie 会被自动发送到所有同域路径。所有修改状态的接口应采用合适的 `SameSite` 策略，并增加 CSRF 防护或严格校验 `Origin`。

### 8.4 路径重写

Nginx 的 `proxy_pass` 是否带尾部斜杠会改变上游收到的路径。每个 location 都需要通过实际请求验证，不依赖肉眼推断。

### 8.5 前端缓存

HTML 不应设置长期强缓存；带内容哈希的静态资源可以长期缓存。路由迁移期间要避免旧 HTML 持续引用旧 API 或 Socket 路径。

### 8.6 Socket.IO

必须同时测试 HTTP 长轮询与 WebSocket。只验证 WebSocket 成功不足以证明 Socket.IO 路由配置正确。

## 9. 验收标准

完成迁移后至少满足：

- 访问 `/` 能进入统一平台首页；
- 访问 `/family-war/` 及其任意前端路由，刷新后不会由 Nginx 返回 404；
- `GET /api/family-war/health` 能正确到达 `family-war` 服务；
- 管理登录、状态查询、退出和单词图片管理均使用新 API 路径；
- 单词提示图片能通过 `/api/family-war/images/*` 正常加载；
- Socket.IO 轮询和 WebSocket 升级均通过 `/socket/family-war/` 工作；
- 平台登录后，`family-war` HTTP API 和 Socket.IO 都能识别同一活动档案；
- 匿名访问 `that-math-things` 等非强制登录的纯前端应用不受影响；
- 不在 URL、前端存储或日志中暴露微信 `openid`、`unionid`、Session ID；
- 旧路径在兼容期结束后被移除；
- 服务端、客户端及集成测试全部通过。

## 10. 暂不包含的工作

本文档只定义路由和认证衔接方向，不代表立即实施以下内容：

- 微信开放平台申请与审核；
- Main Page 的产品设计和 UI；
- 用户、家庭、儿童档案的数据模型落地；
- SQLite、Redis 或其他 Session 存储选型；
- 现有管理员认证的权限模型重构；
- `that-math-things` 的平台导航、可选身份展示等具体接入；
- 云服务器、域名、备案和正式部署。

这些事项应在正式实施前分别形成设计或任务清单。
