# family-war 升级记录：Node 16 → 24 + CRA → Vite

升级范围：Node 16.20.2 → 24.18.0 LTS，CRA 迁移到 Vite
版本号：1.0.0 → 2.2.0

---

## 1. 从 CRA 迁移到 Vite

### 1.1 为什么换 Vite

#### CRA 的问题

| 问题 | 说明 |
|------|------|
| **已归档 / 停止维护** | React 官方已宣布 CRA（create-react-app）不再维护，建议社区迁移到其他方案 |
| **webpack 冷启动慢** | 每次启动都需要全量打包整个应用，项目稍大就是 10-30 秒 |
| **热更新慢** | 修改一行代码要重新打包 → 替换模块，反馈延迟明显 |
| **配置僵化** | 想改 webpack 配置必须 eject（不可逆）或 react-app-rewired + customize-cra（hack 方式） |
| **react-app-rewired 不活跃** | 最后更新是 2020 年，依赖长期未升级，有潜在兼容风险 |
| **Node 版本兼容差** | webpack 依赖 OpenSSL MD4，Node 17+ 需 `--openssl-legacy-provider` flag，Node 22+ 已废弃该 flag，未来彻底不能用 |
| **构建慢** | webpack 全量打包，没有高效的 tree-shaking 和代码分割 |

#### Vite 的优势

| 优势 | 说明 |
|------|------|
| **极速冷启动** | 基于 ESM 原生模块，开发时无需打包，毫秒级启动 |
| **即时热更新** | 按需编译，修改后只替换变更的模块，大项目也是秒级反馈 |
| **原生 ESM** | 利用浏览器原生 ES Module，代码直接下发，不做无畏的转译 |
| **Rollup 构建** | 生产构建用 Rollup，默认 tree-shaking、代码分割、CSS 压缩 |
| **零配置 JSX** | `@vitejs/plugin-react` 开箱即用，自动 JSX runtime |
| **插件生态** | 兼容 Rollup 插件，Vitest 共享 Vite 配置，统一开发与测试体验 |
| **esbuild 预构建** | 用 Go 编写的 esbuild 做依赖预构建，比 webpack 的 JS 打包快 10-100 倍 |
| **长期活跃** | Vite 是 Vue/React 社区主流构建工具，持续维护，生态活跃 |

### 1.2 为什么 `.js` → `.jsx`

CRA（webpack）通过 babel-loader 默认对所有 `.js` 文件自动转译 JSX，所以不写 `.jsx` 也能跑。但这只是 webpack 的配置行为，不是 JavaScript 规范。

Vite 严格遵循文件扩展名的语义：

| 扩展名 | 语义 |
|--------|------|
| `.js` | 纯 JavaScript（不处理 JSX） |
| `.jsx` | 含 JSX 的 JavaScript |
| `.ts` | TypeScript |
| `.tsx` | 含 JSX 的 TypeScript |

迁移后所有含 JSX 的文件必须用 `.jsx` 后缀，否则 Vite 报语法错误。工程规范也由此更清晰：看到 `.jsx` 就知道这里有 JSX 模板代码。

### 1.3 迁移问题清单

| 问题 | 原因 | 解决 |
|------|------|------|
| `react-scripts` 不兼容 | CRA 已归档，webpack 5 的 OpenSSL MD4 问题 | 迁移到 Vite |
| `.js` 含 JSX 无法解析 | Vite 默认只处理 `.jsx` / `.tsx` | 重命名为 `.jsx` |
| `%PUBLIC_URL%` 不识别 | CRA 特有 HTML 占位符 | 替换为 `./` 相对路径 |
| `process.env.PUBLIC_URL` 报错 | CRA 注入的环境变量 | 替换为 `import.meta.env.BASE_URL` |
| `process.env.NODE_ENV` 报错 | CRA 注入的环境变量 | 替换为 `import.meta.env.DEV` |
| 构建输出在 `dist/` 但 nginx 等 `build/` | Vite 默认输出目录不同 | 配置 `build.outDir: 'build'` |
| Vite 不自动打开浏览器 | Vite 无默认行为 | 配置 `server.open: { app: 'Google Chrome' }` |
| `customize-cra` `config-overrides.js` 废弃 | 不再需要 webpack override | 直接删除 |

### 1.4 Jest → Vitest 迁移

| 问题 | 原因 | 解决 |
|------|------|------|
| `jest.fn()` 未定义 | Vitest 全局 API 不同 | 替换为 `vi.fn()` |
| `jest.mock()` 未定义 | 同上 | 替换为 `vi.mock()` |
| `jest.clearAllMocks()` 未定义 | 同上 | 替换为 `vi.clearAllMocks()` |
| `--watchAll=false` 未知选项 | Jest CLI 参数，Vitest 不识别 | 从根 `package.json` 的 test 脚本移除 |
| `setupTests.js` 不生效 | CRA 自动加载，Vite 不会 | 改为 `setup-vitest.js`，在 `vite.config.js` 的 `test.setupFiles` 中指定 |

---

## 2. Node.js 升级：v16.20.2 → v24.18.0 LTS

### 2.1 升级问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `nvm use 24` 后 `node -v` 仍显示 v16 | `nvm alias default` 未更新 | 执行 `nvm alias default 24` |
| 新终端打开 `node` 还是旧版 | 默认版本没设 | 已设置 default 为 24 |
| `yarn: command not found` | yarn 绑定在旧 Node 16 的 bin 目录 | 执行 `corepack enable yarn` |
| `opencode: command not found` | 全局包装在旧 Node 16 的 bin 目录 | 重新 `npm install -g opencode` |
| `pm2: command not found` | 同上 | 重新 `npm install -g pm2` |

### 2.2 Node 版本管理说明

nvm 每个 Node 版本有独立的全局包目录：

```
~/.nvm/versions/node/
├── v16.20.2/bin/    # 旧全局包（opencode, pm2, yarn 等）
├── v20.x.x/bin/
└── v24.18.0/bin/    # 新的全局包目录（需要重新安装）
```

切换 Node 版本后，PATH 指向对应版本的 bin 目录。原先在旧版本下 `npm install -g` 安装的工具在新版本下找不到，需要在新版本重新安装。

---

## 3. 其他问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `npm warn Unknown user config "home"` | `~/.npmrc` 中有无效配置项 `home=https://npm.taobao.org` | 删除该行（镜像地址由 `registry` 维护） |

---

## 4. 最终架构

### 开发环境

```
浏览器 ──→ Vite Dev Server (:3000)
            ├── /api/        ──proxy──→ Koa (:4000)
            └── /socket.io/  ──ws──→ Socket.IO (:4000)
```

### 预发布环境

```
浏览器 ──→ Nginx (:8080)
            ├── /family-war/ (静态文件)  ──→ client/build/
            ├── /family-war/api/          ──proxy──→ Koa (:4010)
            └── /family-war/socket.io/    ──ws──→ Socket.IO (:4010)
                                                    ↑
                                              PM2 管理 (ecosystem.config.js)
```

---

## 5. 验证结果

| 检查项 | 结果 |
|--------|------|
| 服务端测试（Jest） | 77 passed |
| 客户端测试（Vitest） | 47 passed |
| Vite 构建 | 成功（build/ 目录） |
| PM2 运行 | 正常，version 2.2.0 |
| Nginx 静态文件 | HTTP 200 |
| API 代理 | `{"status":"ok"}` |
