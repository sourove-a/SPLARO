import { NextRequest } from 'next/server';
import { POST as sendCampaign } from '../send/route';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const payload = await request.json().catch(() => ({}));
  const mergedBody = { ...payload, mode: 'test' };
  const proxyReq = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(mergedBody),
  });
  return sendCampaign(proxyReq, context);
}
