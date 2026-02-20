import nodemailer from 'nodemailer';

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const MAIL_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2; // initial + 1 retry

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MAIL_TIMEOUT')), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

export async function sendMail(input: MailInput): Promise<void> {
  const from = process.env.SMTP_USER;
  if (!from) {
    throw new Error('SMTP_USER_NOT_CONFIGURED');
  }

  const transporter = getTransporter();
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    try {
      attempt += 1;
      await withTimeout(
        transporter.sendMail({
          from: `SPLARO <${from}>`,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text ?? '',
        }),
        MAIL_TIMEOUT_MS,
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) {
        break;
      }
      await sleep(350);
    }
  }

  throw new Error(
    `MAIL_SEND_FAILED: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
  );
}
