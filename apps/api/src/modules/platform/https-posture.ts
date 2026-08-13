/** Security Center posture — localhost HTTP is expected; production must be https. */
export function httpsEnforcedPosture(
  siteUrl: string,
  nodeEnv: string | undefined,
): { label: 'HTTPS enforced'; value: string; ok: boolean } {
  let hostname = ''
  let protocol = ''
  try {
    const u = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`)
    hostname = u.hostname
    protocol = u.protocol
  } catch {
    protocol = ''
  }
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname)
  if (nodeEnv !== 'production' || loopback) {
    return { label: 'HTTPS enforced', value: 'Off on localhost — expected', ok: true }
  }
  const ok = protocol === 'https:'
  return {
    label: 'HTTPS enforced',
    value: ok ? 'Active' : 'SITE_URL is not https',
    ok,
  }
}
