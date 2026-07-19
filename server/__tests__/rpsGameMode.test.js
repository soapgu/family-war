const RpsGameMode = require('../src/socket/games/RpsGameMode')

const ROBOT_ID = '__robot__'
const P1 = 's1'
const P2 = 's2'

function createMode(config = {}) {
  return new RpsGameMode({ type: 'rps', config, roomManager: { ROBOT_ID } })
}

function mockRoom(game) {
  return {
    id: 'r1',
    players: {},
    roles: {},
    game: game || null,
  }
}

function makeGame(mode, playerIds) {
  return mode.createGame({ roomId: 'r1', playerIds })
}

describe('createGame', () => {
  it('创建含 moves 字段的游戏', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    expect(game.moves).toEqual({})
    expect(game.type).toBe('rps')
    expect(game.players).toEqual([P1, P2])
    expect(game.scores).toEqual({ [P1]: 0, [P2]: 0 })
    expect(game.round).toBe(1)
    expect(game.status).toBe('playing')
  })
})

describe('isValidChoice', () => {
  it('rock/paper/scissors 合法', () => {
    const mode = createMode()
    expect(mode.isValidChoice('rock')).toBe(true)
    expect(mode.isValidChoice('paper')).toBe(true)
    expect(mode.isValidChoice('scissors')).toBe(true)
    expect(mode.isValidChoice('gun')).toBe(false)
  })
})

describe('submitInput', () => {
  it('首次出拳返回 waiting', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const result = mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    expect(result.action).toBe('waiting')
    expect(result.reason).toBe('waiting_opponent')
  })

  it('双方出拳后返回 round_result', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    const result = mode.submitInput({ game, playerId: P2, input: { choice: 'scissors' } })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe(P1)
    expect(result.result.scores[P1]).toBe(1)
  })

  it('平局后 scores 不变，下一局 round++', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    const result = mode.submitInput({ game, playerId: P2, input: { choice: 'rock' } })
    expect(result.action).toBe('round_result')
    expect(result.result.winner).toBe('draw')
    expect(result.result.scores[P1]).toBe(0)
    expect(result.result.scores[P2]).toBe(0)
    expect(game.round).toBe(2)
  })

  it('先赢 2 局触发 match_result', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    mode.submitInput({ game, playerId: P2, input: { choice: 'scissors' } })
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    const result = mode.submitInput({ game, playerId: P2, input: { choice: 'scissors' } })
    expect(result.action).toBe('match_result')
    expect(result.result.matchWinner).toBe(P1)
    expect(result.result.scores[P1]).toBe(2)
  })

  it('无效 choice 返回 error', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const result = mode.submitInput({ game, playerId: P1, input: { choice: 'gun' } })
    expect(result.action).toBe('error')
  })

  it('非本局玩家返回 error', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const result = mode.submitInput({ game, playerId: 's3', input: { choice: 'rock' } })
    expect(result.action).toBe('error')
  })

  it('同一玩家重复出拳返回 error', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    const result = mode.submitInput({ game, playerId: P1, input: { choice: 'paper' } })
    expect(result.action).toBe('error')
  })

  it('比赛结束后出拳返回 error', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    game.status = 'match_end'
    const result = mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    expect(result.action).toBe('error')
  })

  it('match_result 不含 ranking 字段', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    mode.submitInput({ game, playerId: P2, input: { choice: 'scissors' } })
    mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    const result = mode.submitInput({ game, playerId: P2, input: { choice: 'scissors' } })
    expect(result.result.ranking).toBeUndefined()
  })
})

describe('buildStartPayload', () => {
  it('每人视角含 opponent 和 round', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const room = { players: { [P1]: { nickname: '小明', role: '爸爸' }, [P2]: { nickname: '小红', role: '妈妈' } } }
    const payload = mode.buildStartPayload({ game, room, playerId: P1 })
    expect(payload.gameType).toBe('rps')
    expect(payload.opponent.id).toBe(P2)
    expect(payload.opponent.nickname).toBe('小红')
    expect(payload.opponent.role).toBe('妈妈')
    expect(payload.round).toBe(1)
  })
})

describe('buildPlayerRoundResultPayload', () => {
  it('每人视角含 yourMove/oppMove/winner/scores', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, P2])
    const result = { round: 1, winner: P1, moves: { [P1]: 'rock', [P2]: 'scissors' }, scores: { [P1]: 1, [P2]: 0 } }
    const p1p = mode.buildPlayerRoundResultPayload({ game, result, playerId: P1 })
    expect(p1p.yourMove).toBe('rock')
    expect(p1p.oppMove).toBe('scissors')
    expect(p1p.winner).toBe(P1)
    expect(p1p.scores[P1]).toBe(1)
  })
})

describe('buildMatchResultPayload', () => {
  it('含 gameType/scores/history，无 ranking', () => {
    const mode = createMode()
    const result = { matchWinner: P1, scores: { [P1]: 2, [P2]: 0 }, history: [] }
    const payload = mode.buildMatchResultPayload({ result })
    expect(payload.gameType).toBe('rps')
    expect(payload.matchWinner).toBe(P1)
    expect(payload.ranking).toBeUndefined()
  })
})

describe('handleRobotInput', () => {
  it('机器人出拳后返回 waiting（人类未出拳）', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, ROBOT_ID])
    const room = mockRoom(game)
    const result = mode.handleRobotInput({ room, game, robotId: ROBOT_ID })
    expect(result.action).toBe('waiting')
    expect(game.moves[ROBOT_ID]).toBeTruthy()
  })

  it('机器人与人类都出拳后返回 round_result', () => {
    const mode = createMode()
    const game = makeGame(mode, [P1, ROBOT_ID])
    const room = mockRoom(game)
    mode.handleRobotInput({ room, game, robotId: ROBOT_ID })
    const result = mode.submitInput({ game, playerId: P1, input: { choice: 'rock' } })
    expect(result.action).toBe('round_result')
    expect(result.result.moves[ROBOT_ID]).toBeTruthy()
  })
})

describe('getWinningScore', () => {
  it('config.winningScore 存在时使用配置值', () => {
    const mode = createMode({ winningScore: 3 })
    expect(mode.getWinningScore()).toBe(3)
  })

  it('config 不存在时默认 2', () => {
    const mode = createMode()
    expect(mode.getWinningScore()).toBe(2)
  })
})
