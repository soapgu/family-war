const fs = require('fs')
const path = require('path')
const chapters = require('./words.json')

const CONFIG_PATH = path.join(__dirname, 'word-config.json')

let config = loadConfig()

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { enabledChapters: chapters.map((c) => c.chapter), disabledWords: [] }
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
  if (updates.enabledChapters) config.enabledChapters = updates.enabledChapters
  if (updates.disabledWords) config.disabledWords = updates.disabledWords
  saveConfig()
}

function getWordSearchContext(word) {
  const chapter = chapters.find((c) => c.words.includes(word))
  return chapter?.context || ''
}

module.exports = { getChapters, getAllWords, getActiveWords, getConfig, setConfig, getWordSearchContext }
