# 算术模式倒计时不跳动 Bug 分析

## 现象

算术模式第一轮题目出现后，20s 倒计时进度条和数字都卡在初始值（20s），不随时间减少。第二轮起倒计时恢复正常。

## 时间线（服务端视角）

`handler.js` 中的 `handleArithmeticChallenge` 在同一个 Node.js tick 里顺序执行三个 `emit`：

```js
// 第1步 — 发 game:start
playerIds.forEach(id => io.to(id).emit('game:start', { gameType: 'arithmetic', players, round }))

// 第2步 — 发 game:question（紧接第1步）
emitNextArithmeticQuestion(rid, game)
//   → io.to(id).emit('game:question', { questionId, expression, round })

// 第3步 — 发 room:state（紧接第2步）
roomManager.broadcastRoomState(rid, io)
//   → io.to(`room:${rid}`).emit('room:state', state)
```

三个事件通过同一个 TCP/WebSocket 连接送达客户端，到达顺序与发送顺序一致。

## 时间线（客户端视角）

### 事件到达顺序

```
事件1: game:start
   → Room.js onGameStart → setGameInfo(data)
   → React 安排重渲染（异步）

事件2: game:question
   → ArithmeticBoard 可能尚未 mount，listener 未注册
   → 事件可能丢失（timing 敏感）
   若已注册 → onQuestion → startTimer() 启动 setInterval

事件3: room:state
   → App.js setRoomState(newState) → App 重渲染
   → Room.js 收到新 roomState prop → Room 重渲染
```

### 关键链条 — effect 意外 cleanup

`Room.js` 在 `gameInfo` 非 null 时渲染 `ArithmeticBoard`：

```jsx
{gameInfo.gameType === 'arithmetic' ? (
  <ArithmeticBoard gameInfo={gameInfo} onFinish={() => setGameInfo(null)} />
) : (
  // ...
)}
```

`onFinish={() => setGameInfo(null)}` 是内联箭头函数，**每次 Room.js 重渲染都创建一个新引用**。

`ArithmeticBoard` 的 socket listener effect 声明了依赖：

```jsx
useEffect(() => {
  // ... 注册 socket.on('game:question', onQuestion) 等
  // ... onQuestion 内部调用 startTimer()
  return () => {
    socket.off(...)
    clearTimer()    // ← 清理时杀掉计时器
  }
}, [socket, onFinish, startTimer, clearTimer])
//       ^^^^^^^
//       onFinish 每次都是新函数！
```

### 完整死链

```
服务端 broadcastRoomState
  ↓
客户端收到 room:state
  ↓
Room.js setRoomState(newState)
  ↓
Room 重渲染
  ↓
onFinish 生成了新箭头函数
  ↓
React 检测到 ArithmeticBoard 的 useEffect deps 中 onFinish 变化
  ↓
先跑 cleanup:
  socket.off(...) + clearTimer()  →  clearInterval(timerRef.current)
                                      ↑ 计时器被杀
  ↓
再跑 effect（重新注册 listener，但 interval 已死）
  ↓
timeLeft 永远停在 20（或第一次 tick 后的 19）
  ↓
UI 不再更新
```

### 为什么第二轮起正常

后续轮次 `emitNextArithmeticQuestion` 之后**没有** `broadcastRoomState`，`room:state` 不再触发 → Room.js 不重渲染 → `onFinish` 引用不变化 → effect 不 cleanup → interval 存活。

## 修复

三处修改，全在 `client/src/components/ArithmeticBoard.js`。

### 改动 1 — 用 ref 兜住 onFinish

```js
const onFinishRef = useRef(onFinish)

useEffect(() => {
  onFinishRef.current = onFinish
})
```

`useRef` 返回的**永远是同一个对象**，跨渲染 identity 不变。无依赖 `useEffect` 的语义：**每次渲染后执行**，保证 `onFinishRef.current` 始终指向最新 prop。

### 改动 2 — effect 内通过 ref 调用

```diff
-      onFinish()
+      onFinishRef.current()
```

避免 effect 闭包捕获旧值。

### 改动 3 — 移除 onFinish 依赖

```diff
-  }, [socket, onFinish, startTimer, clearTimer])
+  }, [socket, startTimer, clearTimer])
```

effect 只在 mount/unmount 时执行，不再因 parent re-render 而重跑。

### 改动后 effect 生命周期

```
mount → effect 注册 listener
        ↓
room:state 到达 → parent 重渲染
        ↓
onFinishRef.current 被更新（useEffect 无依赖版本）
        ↓
socket effect 依赖没变 → 跳过 → cleanup 不执行
        ↓
interval 存活 → 倒计时正常 tick
        ↓
unmount → cleanup 清理 listener + 杀 timer
```

## 教训与经验

### 1. `useEffect` 依赖数组的策略

[React 官方文档](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies) 要求 deps 包含所有响应式值。但**对于被 ref 兜住的值，effect 不需要依赖它**，因为 ref 的 identity 跨渲染不变，而 `.current` 在 effect 外部已经被更新。

正确做法：

```js
const fnRef = useRef(fn)
useEffect(() => { fnRef.current = fn })   // 保持最新，无依赖
useEffect(() => {
  // 内部用 fnRef.current()
}, [])                                     // effect 不依赖 fn
```

### 2. 内联回调的隐形成本

```jsx
<Component onFinish={() => doSomething()} />
```

每次渲染创建新函数，如果传给 `React.memo` 子组件或用作 `useEffect` 依赖，会导致不必要的重渲染/effect 重跑。

解决：
- 父组件用 `useCallback` 包装
- 子组件用 ref 兜住（如本次修复）
- 或子组件将 `onFinish` 从依赖中移除（如果函数稳定且有 ref 兜底）

### 3. Socket listener effect 应该稳定

socket 事件 listener 的注册/注销应该只发生在 mount/unmount。任何 listener 函数的变更都应该用 ref 兜住，而非通过 effect 重新注册。

```js
// ❌ 错误模式
const [callback, setCallback] = useState(() => () => {})
useEffect(() => {
  socket.on('event', callback)
  return () => socket.off('event', callback)
}, [callback])             // callback 一变就重注册

// ✅ 正确模式
const callbackRef = useRef(callback)
useEffect(() => { callbackRef.current = callback })
useEffect(() => {
  socket.on('event', (data) => callbackRef.current(data))
  return () => socket.off('event', callbackRef.current)
}, [])
```

### 4. React 批量更新的陷阱

React 18+ 在所有场景（包括 `setTimeout`、原生事件回调）都启用自动批处理。这意味着：

```
原生回调（如 socket.io）中调用 setState → 不立即渲染
   ↓
同一次事件循环中的第二个原生回调 → setState 被合并到同一批
   ↓
批处理结束后才统一渲染
```

本次 bug 中，`game:start` 和 `room:state` 的 setState 虽然在不同 socket 回调中，但由于 socket.io 在同一 tick 内依次派发，React 对 `setRoomState` 的渲染被调度到微任务，导致 `room:state` 先触发 re-render 而 game:question 的 listener 尚未准备就绪。

### 5. 调试建议

定位此类问题的 checklist：

- [ ] useEffect 依赖数组是否有不稳定的引用（内联函数/对象）？
- [ ] 该 effect 是否有 cleanup 会产生副作用（清除计时器、取消请求）？
- [ ] 父组件什么情况下会 re-render？
- [ ] socket 事件和服务端 emit 的时序关系如何？
- [ ] 是第 N 次出现异常，还是每次都异常？（第 N 次往往指向 re-render 时机问题）

## 相关文件

| 文件 | 作用 |
|------|------|
| `client/src/components/ArithmeticBoard.js` | bug 所在，修复目标 |
| `server/src/socket/handler.js` | 服务端 emit 时序源头 |
