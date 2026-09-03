const path = require('node:path')
const os = require('node:os')

const APP_ROOT = process.env.SPLARO_APP_DIR || '/var/www/splaro'
const LOG_DIR = process.env.SPLARO_LOG_DIR || path.join(APP_ROOT, 'logs')
const ENV_FILE = `${APP_ROOT}/.env`

module.exports = {
  apps: [
    {
      // Production keeps this stable name across blue/green directory swaps;
      // PM2 can then reload cluster workers one at a time on the same port.
      name: 'splaro-web-live',
      cwd: `${APP_ROOT}/apps/web`,
      script: '.next/standalone/apps/web/server.js',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co',
        NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.splaro.co/api/v1',
      },
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M',
      // out + error only — `log_file` duplicates the same lines and doubled disk use.
      error_file: `${LOG_DIR}/web-error.log`,
      out_file: `${LOG_DIR}/web-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 4000,
      autorestart: true,
    },
    {
      name: 'splaro-admin',
      cwd: `${APP_ROOT}/apps/admin`,
      script: '.next/standalone/apps/admin/server.js',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co',
        NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co',
        ADMIN_URL: process.env.ADMIN_URL || 'https://admin.splaro.co',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.splaro.co/api/v1',
        MCP_UPSTREAM_URL: process.env.MCP_UPSTREAM_URL || 'http://127.0.0.1:4005',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      /*
       * Headroom for /api/upload: sharp decodes a full-resolution photo per
       * job, and the queue allows two at once, so an image drop peaks well past
       * the 512M this used to sit at. PM2 answers that ceiling with SIGKILL —
       * mid-upload, which nginx logged as "upstream prematurely closed
       * connection" and the browser showed as a failed upload.
       */
      max_memory_restart: '1536M',
      /* Let an in-flight upload finish before a restart takes the process. */
      kill_timeout: 30000,
      error_file: `${LOG_DIR}/admin-error.log`,
      out_file: `${LOG_DIR}/admin-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
    },
    {
      name: 'splaro-api',
      cwd: `${APP_ROOT}/apps/api`,
      script: 'dist/main.js',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        API_PORT: 4000,
        SPLARO_TELEGRAM_POLLING: '0',
        WEB_URL: process.env.WEB_URL || 'https://splaro.co',
        ADMIN_URL: process.env.ADMIN_URL || 'https://admin.splaro.co',
        API_URL: process.env.API_URL || 'https://api.splaro.co',
        CORS_ORIGINS: process.env.CORS_ORIGINS || 'https://splaro.co,https://admin.splaro.co',
        MEILISEARCH_HOST: process.env.MEILISEARCH_HOST || '',
      },
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      // Headroom for batch jobs (Google Sheets hub rebuild peaks around 1GB).
      // At 768M both workers tripped the limit on every sync and reloaded,
      // dropping in-flight requests. Two workers at 1.5G still fit 8GB RAM.
      max_memory_restart: '1536M',
      error_file: `${LOG_DIR}/api-error.log`,
      out_file: `${LOG_DIR}/api-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 4000,
      autorestart: true,
      kill_timeout: 10000,
    },
    {
      name: 'splaro-worker',
      cwd: `${APP_ROOT}/apps/worker`,
      script: 'dist/index.js',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: `${LOG_DIR}/worker-error.log`,
      out_file: `${LOG_DIR}/worker-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      restart_delay: 5000,
    },
    {
      name: 'splaro-print',
      cwd: `${APP_ROOT}/tools/print-service`,
      script: 'dist/index.js',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      error_file: `${LOG_DIR}/print-error.log`,
      out_file: `${LOG_DIR}/print-out.log`,
      merge_logs: true,
      autorestart: true,
    },
    {
      // Private MCP HTTP — admin.splaro.co/mcp/* proxies here. Auth = Bearer link token.
      name: 'splaro-mcp',
      cwd: `${APP_ROOT}/tools/mcp-server`,
      script: 'start.mjs',
      env_file: ENV_FILE,
      env: {
        NODE_ENV: 'production',
        MCP_TRANSPORT: 'sse',
        MCP_PORT: 4005,
        MCP_SSE_MESSAGE_PATH: '/mcp/message',
        SPLARO_MCP_STORE_ID: process.env.SPLARO_MCP_STORE_ID || process.env.NEXT_PUBLIC_STORE_ID || 'splaro',
        SPLARO_API_BASE: process.env.SPLARO_API_BASE || 'http://127.0.0.1:4000/api/v1',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '384M',
      error_file: `${LOG_DIR}/mcp-error.log`,
      out_file: `${LOG_DIR}/mcp-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000,
    },
  ],
}
