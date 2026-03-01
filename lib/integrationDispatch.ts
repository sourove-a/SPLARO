import { randomUUID } from 'node:crypto';
import { appendRow } from './sheets';
import { sendTelegramMessage } from './telegram';
import { enqueueJob, markJobDone } from './queue';
import { writeSystemLog } from './log';

type IntegrationEventType = 'ORDER_CREATED' | 'USER_SIGNUP' | 'SUBSCRIBED';

type OrderEventPayload = {
  order_id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  thana: string;
  product_name: string;
  product_url?: string;
  image_url?: string;
  quantity: number;
  notes?: string;
  status: string;
};

type SignupEventPayload = {
  user_id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  district: string;
  thana: string;
  address: string;
  source: string;
  verified: boolean;
};

type SubscribeEventPayload = {
  sub_id: string;
  created_at: string;
  email: string;
  consent: boolean;
  source: string;
};

type AnyPayload = OrderEventPayload | SignupEventPayload | SubscribeEventPayload;

function safeText(input: unknown): string {
  return String(input ?? '').trim();
}

function detached<T>(promise: Promise<T>): void {
  promise.catch((error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'integration_detached_failed',
        ts: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
}

async function emitTelegram(eventType: IntegrationEventType, payload: AnyPayload): Promise<void> {
  let text = '';
  if (eventType === 'ORDER_CREATED') {
    const row = payload as OrderEventPayload;
    text = [
      '🛒 New Order',
      `Order ID: ${safeText(row.order_id)}`,
      `Name: ${safeText(row.name)}`,
      `Phone: ${safeText(row.phone)}`,
      `Email: ${safeText(row.email)}`,
      `Product: ${safeText(row.product_name)}`,
      `Qty: ${safeText(row.quantity)}`,
      `Status: ${safeText(row.status)}`,
    ].join('\n');
  } else if (eventType === 'USER_SIGNUP') {
    const row = payload as SignupEventPayload;
    text = [
      '✅ New Signup',
      `User ID: ${safeText(row.user_id)}`,
      `Name: ${safeText(row.name)}`,
      `Phone: ${safeText(row.phone)}`,
      `Email: ${safeText(row.email)}`,
    ].join('\n');
  } else {
    const row = payload as SubscribeEventPayload;
    text = [
      '📩 New Subscriber',
      `Email: ${safeText(row.email)}`,
      `Source: ${safeText(row.source)}`,
      `Consent: ${row.consent ? 'true' : 'false'}`,
    ].join('\n');
  }

  const result = await sendTelegramMessage(text);
  if (!result.ok) {
    throw new Error(result.error || 'TELEGRAM_SEND_FAILED');
  }
}

async function emitSheet(eventType: IntegrationEventType, payload: AnyPayload): Promise<void> {
  if (eventType === 'ORDER_CREATED') {
    const row = payload as OrderEventPayload;
    await appendRow('ORDERS', [
      row.order_id,
      row.created_at,
      row.name,
      row.email,
      row.phone,
      row.address,
      row.district,
      row.thana,
      row.product_name,
      row.product_url || '',
      row.image_url || '',
      row.quantity,
      row.notes || '',
      row.status,
    ]);
    return;
  }

  if (eventType === 'USER_SIGNUP') {
    const row = payload as SignupEventPayload;
    await appendRow('USERS', [
      row.user_id,
      row.created_at,
      row.name,
      row.email,
      row.phone,
      row.district,
      row.thana,
      row.address,
      row.source,
      row.verified ? 'true' : 'false',
    ]);
    return;
  }

  const row = payload as SubscribeEventPayload;
  await appendRow('SUBSCRIPTIONS', [
    row.sub_id,
    row.created_at,
    row.email,
    row.consent ? 'true' : 'false',
    row.source,
  ]);
}

export async function processIntegrationPayload(eventType: IntegrationEventType, payload: AnyPayload): Promise<void> {
  const settled = await Promise.allSettled([
    emitTelegram(eventType, payload),
    emitSheet(eventType, payload),
  ]);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed && failed.status === 'rejected') {
    throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
  }
}

async function dispatchIntegrationEvent(eventType: IntegrationEventType, payload: AnyPayload): Promise<void> {
  const key = `${eventType}:${safeText((payload as any).order_id || (payload as any).user_id || (payload as any).sub_id || randomUUID())}`;
  const inserted = await enqueueJob({
    type: eventType === 'ORDER_CREATED' ? 'ORDER_EVENT' : eventType === 'USER_SIGNUP' ? 'TELEGRAM' : 'SHEETS',
    payload: {
      eventType,
      payload,
    },
    idempotencyKey: key,
    maxAttempts: Number(process.env.QUEUE_MAX_ATTEMPTS || 5),
  });

  try {
    await processIntegrationPayload(eventType, payload);
    await markJobDone(inserted.id, null);
  } catch (error) {
    await writeSystemLog({
      eventType: 'INTEGRATION_EVENT_FAILED',
      description: `${eventType}: ${error instanceof Error ? error.message : String(error)}`,
    });
    await markJobDone(inserted.id, error instanceof Error ? error.message : String(error));
  }
}

export function fireIntegrationEvent(eventType: IntegrationEventType, payload: AnyPayload): void {
  detached(dispatchIntegrationEvent(eventType, payload));
}
