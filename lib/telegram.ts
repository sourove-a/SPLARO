type TelegramSendResult = {
  ok: boolean;
  error?: string;
};

const TELEGRAM_TIMEOUT_MS = 5_000;
const TELEGRAM_MAX_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, error: 'TELEGRAM_NOT_CONFIGURED' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let attempt = 0;
  let lastError = 'UNKNOWN';

  while (attempt < TELEGRAM_MAX_ATTEMPTS) {
    try {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return { ok: true };
      }

      const payload = await response.text();
      lastError = `HTTP_${response.status}:${payload.slice(0, 180)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < TELEGRAM_MAX_ATTEMPTS) {
      await sleep(300);
    }
  }

  return { ok: false, error: `TELEGRAM_SEND_FAILED:${lastError}` };
}
