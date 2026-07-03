/**
 * Hostinger / home-directory deploy — web + admin + API only.
 * Skips worker/print (need Redis/local services). Logs under $APP_ROOT/logs.
 */
const path = require('node:path')
const os = require('node:os')

const APP_ROOT = process.env.SPLARO_APP_DIR || path.join(os.homedir(), 'splaro')
const LOG_DIR = process.env.SPLARO_LOG_DIR || path.join(APP_ROOT, 'logs')

const sharedEnv = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co',
  NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.splaro.co/api/v1',
  WEB_URL: process.env.WEB_URL || 'https://splaro.co',
  ADMIN_URL: process.env.ADMIN_URL || 'https://admin.splaro.co',
  API_URL: process.env.API_URL || 'https://api.splaro.co',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'https://splaro.co,https://admin.splaro.co',
}

module.exports = {
  apps: [
    {
      name: 'splaro-web',
      cwd: `${APP_ROOT}/apps/web`,
      script: 'node',
      args: '.next/standalone/apps/web/server.js',
      env: { ...sharedEnv, PORT: 3000, HOSTNAME: '127.0.0.1' },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      log_file: `${LOG_DIR}/web.log`,
      error_file: `${LOG_DIR}/web-error.log`,
      out_file: `${LOG_DIR}/web-out.log`,
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
    },
    {
      name: 'splaro-admin',
      cwd: `${APP_ROOT}/apps/admin`,
      script: 'node',
      args: '.next/standalone/apps/admin/server.js',
      env: { ...sharedEnv, PORT: 3001, HOSTNAME: '127.0.0.1' },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      log_file: `${LOG_DIR}/admin.log`,
      error_file: `${LOG_DIR}/admin-error.log`,
      out_file: `${LOG_DIR}/admin-out.log`,
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
    },
    {
      name: 'splaro-api',
      cwd: `${APP_ROOT}/apps/api`,
      script: 'dist/main.js',
      env: { ...sharedEnv, API_PORT: 4000 },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '768M',
      log_file: `${LOG_DIR}/api.log`,
      error_file: `${LOG_DIR}/api-error.log`,
      out_file: `${LOG_DIR}/api-out.log`,
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
      kill_timeout: 10000,
    },
  ],
}
