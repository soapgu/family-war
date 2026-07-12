module.exports = {
  apps: [{
    name: 'family-war-server',
    script: 'src/index.js',
    cwd: __dirname,
    env: { PORT: 4010, NODE_ENV: 'production' },
    instances: 1,
    exec_mode: 'fork',
    max_restarts: 5,
    error_file: '../logs/server-err.log',
    out_file: '../logs/server-out.log',
  }]
}
