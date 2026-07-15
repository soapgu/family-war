const fs = require('fs')
const path = require('path')

const config = {
  unsplashAccessKey: '',
}

const localPath = path.join(__dirname, 'config.local.js')
if (fs.existsSync(localPath)) {
  const local = require(localPath)
  Object.assign(config, local)
}

module.exports = config
