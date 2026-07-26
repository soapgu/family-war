# family-war — agent guide

## three packages, one root

```
root package.json  (concurrently orchestrates all three)
├── client/   React 19 + Vite + Antd v5 + Socket.IO client (port :3000)
├── admin-client/ React 19 + Vite + Antd v5, no Socket.IO (port :3001)
└── server/   Koa + Socket.IO + Jest + nodemon (port :4000)
```

## commands

| what | command | notes |
|------|---------|-------|
| dev (all) | `npm run dev` | concurrently server + client + admin-client |
| server only | `npm run server` | nodemon |
| client only | `npm run client` | Vite dev server |
| admin only | `npm run admin` | Vite dev server |
| all builds | `npm run build` | client + admin-client |
| verify builds | `npm run build:verify` | checks isolated build outputs |
| client build | `npm run build --prefix client` | outputs to `client/build/` |
| admin build | `npm run build --prefix admin-client` | outputs to `admin-client/build/` |
| client preview | `npm run preview --prefix client` | preview production build |
| all unit tests | `npm test` | server Jest + client/admin Vitest concurrently |
| server unit | `npm test --prefix server` | |
| server unit watch | `npm run test:watch --prefix server` | |
| server integration | `npm run test:integration` | plain Node script, real sockets, port :4001 |
| gateway acceptance | `npm run test:gateway` | requires `GATEWAY_BASE_URL`, checks new/legacy API and Socket paths |
| client unit | `npm test --prefix client` | Vitest |
| client unit watch | `npm run test:watch --prefix client` | |
| admin unit | `npm test --prefix admin-client` | Vitest |
| admin acceptance | `npm run test:acceptance -- --reset` | requires `ACCEPTANCE_ADMIN_URL` / `ACCEPTANCE_API_URL` / `ACCEPTANCE_ADMIN_PASSWORD` |
| admin acceptance check | `npm run test:acceptance:check` | offline structure check |
| client acceptance | `npm run test:acceptance:client` | requires `npm run dev` running; accepts `CLIENT_BASE_URL` env |
| client acceptance check | `npm run test:acceptance --prefix client -- --check` | offline structure check |
| Unsplash API tests | `npm run test:unsplash --prefix server` | requires `UNSPLASH_ACCESS_KEY` env |
| sync Unsplash images | `npm run unsplash:sync --prefix server` | `--keep` to save locally |
| release | `gh release create vX --title "vX" --notes-file /tmp/NOTES.md` | annotated tags, see `docs/RELEASE.md` |

## architecture facts

- **No database** — all state in `server/src/socket/roomManager.js` / `gameManager.js` singletons
- **Socket.IO is a module-level singleton** on client (`client/src/hooks/useSocket.js`). Tests mock via `client/src/hooks/__mocks__/useSocket.js` (exports `triggerSocketEvent`)
- **Client socket URL** — dev: `http://{hostname}:4000` with `/socket.io`; production: `/` with `/socket/family-war/`
- **Production API base** — `/api/family-war`; legacy `/family-war/api/` remains temporarily available at Nginx
- **Vite proxy** (`client/vite.config.js`): forwards `/api` → `:4000`, `/socket.io` → `:4000` (ws)
- **Vite base** is `/family-war/` for production (nginx reverse proxy)
- **Admin Vite base** is `/admin/`; its production output is `admin-client/build/`
- **Admin platform registry** is `admin-client/src/app/appRegistry.js`; platform navigation and home cards use the same metadata.
- **Admin module public boundary** is `admin-client/src/modules/<module>/index.js`; platform code must not import module-internal pages or API files directly.
- **Admin request states** use `RequestState`; top-level route rendering is protected by `AppErrorBoundary`.
- **Three game modes**: RPS (1v1), 算术 (arithmetic, all-vs-all), 默写 (spelling, all-vs-all with TTS + Unsplash images)
- **Spelling mode** uses `server/src/data/words.json` word bank (每章包含 `context` 字段配文章节上下文，用于 Unsplash 搜索退选); difficulty levels: `easy` / `normal` / `hard`
- **Room ID** hardcoded to `'default'`; `roomId` param on events is a design预留
- **Robot player** `id: '__robot__'`, role `'机器人'` — always present, never human-selectable
- **State lost on page refresh** — no URL for room, Home/Room toggle is `GameApp` state

## testing quirks

- Integration test (`server/tests/integration.js`): plain Node script using real Socket.IO connections on port **4001**. Server must not already be running on that port.
- Unsplash tests (`server/__tests__/unsplashClient.test.js`) require `UNSPLASH_ACCESS_KEY` env var — 3 tests fail without it (expected).
- Client tests import `useSocket` — automock via `__mocks__/useSocket.js` in same directory.
- Playwright acceptance: `admin-client/tests/acceptance/` (admin UI) and `client/tests/acceptance/` (game UI); the server package has no browser-test dependency. Playwright is installed at root `node_modules/` shared by both sub-packages.
- `setup-vitest.js` mocks `matchMedia`, `AudioContext`, suppresses React Router Future Flag warnings.
- Server: Jest v29; Client: Vitest v3 + jsdom.

## UI / conventions

- Roles: `爸爸`, `妈妈`, `儿子`, `机器人`
- BGM: `<audio>` elements with mp3 in `client/public/`. UI sfx: Web Audio API oscillator synthesis (in `Room.js`)
- Game client only renders `<GameApp/>`; Home/Room remains state-controlled with no room URL.
- Admin BrowserRouter uses basename `/admin` with `/`, `/family-war`, `/family-war/word-config`, and an explicit in-app 404 page.
- Plain JS (no TypeScript). `jsconfig.json` for VSCode intellisense.
- All JSX source files use `.jsx` extension (Vite requirement).
