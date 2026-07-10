/**
 * Serialize JSON-LD for safe injection inside `<script type="application/ld+json">`.
 * JSON.stringify alone does not escape `<`, `>`, `&`, or line-separator chars that can
 * break out of a script block or enable XSS when product/admin fields are embedded.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
