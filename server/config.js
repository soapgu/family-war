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
}

const localPath = path.join(__dirname, 'config.local.js')
if (fs.existsSync(localPath)) {
  const local = require(localPath)
  Object.keys(local).forEach((key) => {
    if (key === 'games') {
      config.games = deepMerge(defaultGameConfig, local.games)
    } else {
      config[key] = local[key]
    }
  })
}

module.exports = config
module.exports.DEFAULT_GAME_CONFIG = defaultGameConfig
