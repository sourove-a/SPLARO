import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const legacyPublicHtmlDir = path.join(root, 'public_html');

const hasDistFiles = (() => {
  if (!existsSync(distDir)) return false;
  const entries = readdirSync(distDir).filter((entry) => !entry.startsWith('.'));
  return entries.length > 0;
})();

if (hasDistFiles) {
  console.log('[ensure-hostinger-dist] dist already present; skipping fallback copy.');
  process.exit(0);
}

if (!existsSync(legacyPublicHtmlDir)) {
  console.log('[ensure-hostinger-dist] public_html fallback not found; creating empty dist marker.');
  mkdirSync(distDir, { recursive: true });
  process.exit(0);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
cpSync(legacyPublicHtmlDir, distDir, {
  recursive: true,
  force: true,
});

console.log('[ensure-hostinger-dist] dist generated from public_html fallback for Hostinger output directory.');
