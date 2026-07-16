const fs = require('fs')
const path = require('path')
const chapters = require('./words.json')

const CONFIG_PATH = path.join(__dirname, 'word-config.json')
const chapterNames = new Set(chapters.map((c) => c.chapter))
const allWords = new Set(chapters.flatMap((c) => c.words))

let config = loadConfig()

function defaultConfig() {
  return { enabledChapters: chapters.map((c) => c.chapter), disabledWords: [] }
}

function loadConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    return {
      enabledChapters: Array.isArray(saved.enabledChapters)
        ? [...new Set(saved.enabledChapters.filter((chapter) => chapterNames.has(chapter)))]
        : defaultConfig().enabledChapters,
      disabledWords: Array.isArray(saved.disabledWords)
        ? [...new Set(saved.disabledWords.filter((word) => allWords.has(word)))]
        : [],
    }
  } catch {
    return defaultConfig()
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

function getChapters() {
  return chapters
}

function getAllWords() {
  return chapters.flatMap((c) => c.words)
}

function getActiveWords() {
  return chapters
    .filter((c) => config.enabledChapters.includes(c.chapter))
    .flatMap((c) => c.words)
    .filter((w) => !config.disabledWords.includes(w))
}

function getConfig() {
  return { ...config }
}

function setConfig(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('词库配置必须是对象')
  }

  const next = {
    enabledChapters: [...config.enabledChapters],
    disabledWords: [...config.disabledWords],
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'enabledChapters')) {
    if (!Array.isArray(updates.enabledChapters)) throw new Error('enabledChapters 必须是数组')
    if (updates.enabledChapters.some((chapter) => !chapterNames.has(chapter))) {
      throw new Error('enabledChapters 包含不存在的章节')
    }
    next.enabledChapters = [...new Set(updates.enabledChapters)]
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'disabledWords')) {
    if (!Array.isArray(updates.disabledWords)) throw new Error('disabledWords 必须是数组')
    if (updates.disabledWords.some((word) => !allWords.has(word))) {
      throw new Error('disabledWords 包含不在词库中的单词')
    }
    next.disabledWords = [...new Set(updates.disabledWords)]
  }

  const enabled = new Set(next.enabledChapters)
  const disabled = new Set(next.disabledWords)
  const activeCount = chapters
    .filter((chapter) => enabled.has(chapter.chapter))
    .flatMap((chapter) => chapter.words)
    .filter((word) => !disabled.has(word)).length

  if (activeCount === 0) throw new Error('至少需要保留一个可用的默写单词')

  config = next
  saveConfig()
}

function getWordSearchContext(word) {
  const chapter = chapters.find((c) => c.words.includes(word))
  return chapter?.context || ''
}

module.exports = { getChapters, getAllWords, getActiveWords, getConfig, setConfig, getWordSearchContext }
