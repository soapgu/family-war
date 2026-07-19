/**
 * 游戏模式注册表。
 *
 * 负责：
 * - 定义各游戏模式的默认配置（DEFAULT_GAME_CONFIG）
 * - 合并外部配置与默认配置（resolveGameConfig）
 * - 创建并管理 GameMode 实例（createGameRegistry）
 *
 * 使用实例而不是静态方法的原因：
 * - 方便注入 config / wordBank / unsplashClient 等依赖
 * - 方便测试时 mock 依赖
 * - 每个模式可以持有自己的配置
 *
 * 当前 server/config.js 还没有 config.games 结构，
 * 因此 gameRegistry 必须自己提供兜底默认值。
 * Phase 2 做配置统一时可以把这些默认值搬进 server/config.js。
 */

/**
 * 三种游戏模式的默认配置。
 *
 * Phase 1 的硬编码兜底，保证即使配置文件未扩展也能正常启动。
 * Phase 2 会把这些值迁移到 server/config.js 并支持 config.local.js 覆盖。
 */
const DEFAULT_GAME_CONFIG = {
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

/**
 * 合并外部配置与默认配置。
 *
 * 这里不做简单浅合并（例如 Object.assign），因为 spelling.difficulties
 * 是嵌套对象，浅合并会导致只覆盖一个难度时丢掉其他难度的默认值。
 *
 * @param {Object} [config={}] - 完整应用配置，其中 config.games 为可选
 * @returns {Object} 每个模式的安全配置对象
 */
function resolveGameConfig(config = {}) {
  const custom = config.games || {}

  return {
    rps: {
      ...DEFAULT_GAME_CONFIG.rps,
      ...(custom.rps || {}),
    },
    arithmetic: {
      ...DEFAULT_GAME_CONFIG.arithmetic,
      ...(custom.arithmetic || {}),
    },
    spelling: {
      ...DEFAULT_GAME_CONFIG.spelling,
      ...(custom.spelling || {}),
      // spelling.difficulties 是三层嵌套，需要逐层深度合并
      difficulties: {
        easy: {
          ...DEFAULT_GAME_CONFIG.spelling.difficulties.easy,
          ...(custom.spelling?.difficulties?.easy || {}),
        },
        normal: {
          ...DEFAULT_GAME_CONFIG.spelling.difficulties.normal,
          ...(custom.spelling?.difficulties?.normal || {}),
        },
        hard: {
          ...DEFAULT_GAME_CONFIG.spelling.difficulties.hard,
          ...(custom.spelling?.difficulties?.hard || {}),
        },
      },
    },
  }
}

/**
 * 创建游戏模式注册表。
 *
 * @param {Object} deps
 * @param {Object} deps.config - 应用配置（含 config.games 可选）
 * @param {Object} deps.roomManager - 房间管理器
 * @param {Object} [deps.wordBank] - 词库服务（SpellingGameMode 需要）
 * @param {Object} [deps.unsplashClient] - 图片服务（SpellingGameMode 需要）
 * @returns {{ get: Function, has: Function, list: Function }}
 */
function createGameRegistry(deps) {
  // 使用懒加载 require，便于分步骤创建具体 GameMode 文件。
  // 在 RpsGameMode / ArithmeticGameMode / SpellingGameMode 创建完成前，
  // 调用 createGameRegistry 会抛出 MODULE_NOT_FOUND 错误（预期的行为）。
  const RpsGameMode = require('./RpsGameMode')
  const ArithmeticGameMode = require('./ArithmeticGameMode')
  const SpellingGameMode = require('./SpellingGameMode')

  const gamesConfig = resolveGameConfig(deps.config)

  const modes = {
    rps: new RpsGameMode({
      ...deps,
      config: gamesConfig.rps,
    }),

    arithmetic: new ArithmeticGameMode({
      ...deps,
      config: gamesConfig.arithmetic,
    }),

    spelling: new SpellingGameMode({
      ...deps,
      config: gamesConfig.spelling,
    }),
  }

  return {
    /**
     * 获取指定游戏模式实例。
     * @param {'rps'|'arithmetic'|'spelling'} type
     * @returns {BaseGameMode}
     */
    get(type) {
      const mode = modes[type]
      if (!mode) throw new Error(`Unsupported game type: ${type}`)
      return mode
    },

    /** 判断是否支持某个游戏模式。 */
    has(type) {
      return !!modes[type]
    },

    /** 获取所有支持的游戏类型列表。 */
    list() {
      return Object.keys(modes)
    },
  }
}

module.exports = createGameRegistry
module.exports.DEFAULT_GAME_CONFIG = DEFAULT_GAME_CONFIG
module.exports.resolveGameConfig = resolveGameConfig
