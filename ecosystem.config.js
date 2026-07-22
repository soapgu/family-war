module.exports = {
  apps: [{
    name: 'family-war-server',
    script: 'src/index.js',
    cwd: './server',
    env: {
      NODE_ENV: 'production',
      PORT: '4010',
    },
  }],
}
