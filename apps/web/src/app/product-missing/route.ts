import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Real HTTP 404 for unknown product slugs.
 * Middleware rewrites `/products/[missing]` here — App Router pages soft-200
 * on VPS even when middleware sets status: 404.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Product not found | SPLARO</title>
<style>
  :root { color-scheme: light only; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
    background: #ffffff;
    color: #101114;
  }
  .card { width: min(100% - 2rem, 22rem); text-align: center; padding: 1.5rem 0; }
  .code {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: rgba(16,17,20,0.42);
  }
  h1 {
    margin: 0.55rem 0 0.4rem;
    font-size: 1.45rem;
    letter-spacing: -0.02em;
  }
  p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.55;
    color: rgba(16,17,20,0.58);
  }
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1.35rem;
    min-height: 2.75rem;
    padding: 0 1.25rem;
    border-radius: 999px;
    background: #111111;
    color: #fff;
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 700;
  }
</style>
</head>
<body>
  <main class="card">
    <p class="code">404</p>
    <h1>Product not found</h1>
    <p>This piece is no longer available or the link may be wrong.</p>
    <a href="/shop">Back to Shop</a>
  </main>
</body>
</html>`

  return new NextResponse(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  })
}
