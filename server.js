/**
 * Hostinger hPanel Node.js entry file (Deployments → Entry file: server.js).
 * The stack app listens on process.env.PORT, boots the upstreams
 * (web :3001, admin :3002, API :4000) and reverse-proxies to them.
 */
require('./infrastructure/hostinger/passenger-stack-app.cjs')
