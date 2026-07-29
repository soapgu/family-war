const fs = require('fs')
const path = require('path')

const defaultGameConfig = {
  rps: {
    winningScore: 2,
  },
  arithmetic: {
    winningScore: 5,
    questionTimeLimitMs: 20000,
    robotAnswerDelayMs: 20000,
  },
  spelling: {
    winningScore: 5,
    difficulties: {
      easy: {
        questionTimeLimitMs: 40000,
        robotAnswerDelayMs: 40000,
      },
      normal: {
        questionTimeLimitMs: 30000,
        robotAnswerDelayMs: 30000,
      },
      hard: {
        questionTimeLimitMs: 20000,
        robotAnswerDelayMs: 20000,
      },
    },
  },
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (result[key] && typeof result[key] === 'object' && typeof source[key] === 'object' && !Array.isArray(result[key]) && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

const config = {
  unsplashAccessKey: '',
  unsplashPerPage: 10,
  games: defaultGameConfig,
  auth: {
    adminPassword: '',
    jwtSecret: '',
  },
}

const localPath = path.join(__dirname, 'config.local.js')
if (fs.existsSync(localPath)) {
  const local = require(localPath)
  Object.keys(local).forEach((key) => {
    if (key === 'games') {
      config.games = deepMerge(defaultGameConfig, local.games)
    } else if (key === 'auth') {
      config.auth = deepMerge(config.auth, local.auth)
    } else {
      config[key] = local[key]
    }
  })
}

// E2E_FAST 环境变量：加速默写比赛的分数门槛、题目时限和机器人延迟
// 仅在 Playwright E2E 测试中启用，普通 dev / prod 不受影响
// robotAnswerDelayMs 设为 5000ms：与 5s 题目时限相等，机器人恰在题末作答，
// 给玩家留足填字时间，避免机器人在玩家还没填完时提前推进题目造成竞态。
if (process.env.E2E_FAST === '1') {
  config.games = deepMerge(config.games, {
    spelling: {
      winningScore: 2,
      difficulties: {
        easy:   { questionTimeLimitMs: 5000, robotAnswerDelayMs: 5000 },
        normal: { questionTimeLimitMs: 5000, robotAnswerDelayMs: 5000 },
        hard:   { questionTimeLimitMs: 5000, robotAnswerDelayMs: 5000 },
      },
    },
  })
}

module.exports = config
module.exports.DEFAULT_GAME_CONFIG = defaultGameConfig
