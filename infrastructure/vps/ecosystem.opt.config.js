/**
 * SPLARO VPS @ /opt/splaro/app — ports 3001/3002/4000 (hunterflow uses 3000/8080)
 * pm2 start infrastructure/vps/ecosystem.opt.config.js
 */
const APP = process.env.SPLARO_APP_DIR || '/opt/splaro/app'
const ENV_FILE = `${APP}/.env`

function envBlock(extra = {}) {
  return {
    NODE_ENV: 'production',
    ...extra,
  }
}

module.exports = {
  apps: [
    {
      name: 'splaro-api',
      cwd: `${APP}/apps/api`,
      script: 'bash',
      args: `-lc "set -a; source ${ENV_FILE}; set +a; exec node dist/main.js"`,
      env: envBlock({ API_PORT: 4000 }),
      max_memory_restart: '768M',
      autorestart: true,
    },
    {
      name: 'splaro-web',
      cwd: `${APP}/apps/web`,
      script: 'bash',
      args: `-lc "set -a; source ${ENV_FILE}; set +a; exec npx next start -p 3001 -H 127.0.0.1"`,
      env: envBlock(),
      max_memory_restart: '512M',
      autorestart: true,
    },
    {
      name: 'splaro-admin',
      cwd: `${APP}/apps/admin`,
      script: 'bash',
      args: `-lc "set -a; source ${ENV_FILE}; set +a; exec npx next start -p 3002 -H 127.0.0.1"`,
      env: envBlock(),
      max_memory_restart: '512M',
      autorestart: true,
    },
  ],
}
