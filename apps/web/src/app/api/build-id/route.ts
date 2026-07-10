import { getBuildId } from '@/lib/build-id'

export const dynamic = 'force-dynamic'

/** Fresh build id — compare with cached HTML meta to detect stale deploy cache. */
export async function GET() {
  return Response.json(
    { buildId: getBuildId() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  )
}
