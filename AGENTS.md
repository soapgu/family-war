# family-war — agent guide

## two packages, one root

```
root package.json  (concurrently orchestrates both)
├── client/   React 19 + react-app-rewired + Antd v5 + Socket.IO client
└── server/   Koa + Socket.IO + Jest (nodemon for dev)
```

## commands

| what | command | notes |
|------|---------|-------|
| dev | `npm run dev` | starts both client (:3000) and server (:4000) concurrently |
| server only | `npm run server` | or `npm run dev --prefix server` (nodemon) |
| client only | `npm run client` | or `npm start --prefix client` |
| all unit tests | `npm test` | runs server Jest + client Jest concurrently |
| server unit | `npm test --prefix server` | Jest direct, not CRA wrapper |
| server unit watch | `npm run test:watch --prefix server` | |
| server integration | `npm run test:integration` | raw node script, not Jest |
| client unit | `npm test --prefix client` | wrapped by react-app-rewired |

## architecture facts

- **No database** — all state lives in `server/src/socket/roomManager.js` / `gameManager.js` singletons
- **Socket.IO is a module-level singleton** on the client (`client/src/hooks/useSocket.js`). Not tied to React lifecycle. Tests must mock it via `client/src/hooks/__mocks__/useSocket.js`
- **Client socket URL** resolves dynamically: `http://{window.location.hostname}:4000` in dev, supports LAN
- **CRA proxy** (`client/src/setupProxy.js`) forwards `/api` → `:4000` and `/socket.io` → `:4000` (with WebSocket)
- **Room ID** is hardcoded to `'default'` everywhere; `roomId` param exists on events as a design预留
- **Robot player** has `id: '__robot__'`, role `'机器人'` — always present, never human-selectable

## v2.0 arithmetic mode

Arithmetic mode is fully implemented. See README for details — mode switch (`Segmented` in `Room.js`), question/answer/timer UI (`ArithmeticBoard.js`), and match result (`ArithmeticMatchResult.js`).

## testing quirks

- Server integration test (`server/tests/integration.js`) is a plain Node script with real Socket.IO connections — not Jest. Requires server not already running on :4000.
- Client `setupTests.js` mocks `matchMedia`, `AudioContext`, and suppresses React Router Future Flag warnings.
- Client tests import `useSocket` — the mock file lives in `__mocks__/useSocket.js` adjacent to the real hook.
- Test coverage: 138 assertions total (server unit: 77, server integration: 36, client unit: 25).

## UI / conventions

- Roles (constants): `爸爸`, `妈妈`, `儿子`, `机器人` — used both in UI strings and socket event data
- Audio: BGM uses `<audio>` elements with mp3 files in `client/public/`. UI sfx use Web Audio API (oscillator synthesis in `Room.js`)
- Routing: `/admin` → `<Admin/>`, everything else → `<GameApp/>` (state-controlled Home/Room toggle, no URL for room)
- Client is plain JS (no TypeScript). `jsconfig.json` provides VSCode intellisense.
- `config-overrides.js` uses `customize-cra` (currently empty — placeholder for future overrides)

## release

See `docs/RELEASE.md` — uses `gh release create` with annotated tags.
