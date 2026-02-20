import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { validateOrderPayload } from '@/lib/apiValidators';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { sendMail } from '@/lib/mailer';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';

function toMoney(value?: number): Prisma.Decimal | null {
  if (value == null || Number.isNaN(value)) return null;
  return new Prisma.Decimal(value.toFixed(2));
}

function padInvoice(orderNumber: number): string {
  return `SPL-${String(orderNumber).padStart(6, '0')}`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({ key: `api_order:${ip}`, limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (body?.website) {
    return NextResponse.json({ success: false, message: 'Spam blocked' }, { status: 400 });
  }

  const parsed = validateOrderPayload(body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ success: false, message: parsed.message ?? 'Invalid request' }, { status: 400 });
  }

  const {
    name,
    email,
    phone,
    address,
    district,
    thana,
    product_name,
    product_url,
    image_url,
    quantity,
    unit_price,
    shipping,
    discount,
    notes,
  } = parsed.data;

  const calculatedSubtotal = (unit_price ?? 0) * quantity;
  const total = Math.max(0, calculatedSubtotal + (shipping ?? 0) - (discount ?? 0));

  const created = await prisma.order.create({
    data: {
      name,
      email,
      phone,
      address,
      district,
      thana,
      productName: product_name,
      productUrl: product_url || null,
      imageUrl: image_url || null,
      quantity,
      unitPrice: toMoney(unit_price),
      subtotal: toMoney(calculatedSubtotal),
      shipping: toMoney(shipping),
      discount: toMoney(discount),
      total: toMoney(total),
      notes: notes || null,
      status: 'PENDING',
    },
    select: {
      id: true,
      orderNumber: true,
    },
  });

  const orderId = padInvoice(created.orderNumber);
  await prisma.order.update({
    where: { id: created.id },
    data: { orderId },
  });

  const html = `
    <h2>SPLARO Invoice</h2>
    <p>Order: <strong>${orderId}</strong></p>
    <p>Customer: ${name}</p>
    <p>Product: ${product_name}</p>
    <p>Quantity: ${quantity}</p>
    <p>Total: BDT ${total.toFixed(2)}</p>
  `;

  try {
    await sendMail({
      to: email,
      subject: `SPLARO Invoice ${orderId}`,
      html,
      text: `Order ${orderId} confirmed. Total BDT ${total.toFixed(2)}.`,
    });
  } catch (error) {
    console.error('mail_invoice_failed', {
      orderId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await sendTelegramMessage(
    [
      '<b>🛒 New Order</b>',
      `Order: <b>${orderId}</b>`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `District/Thana: ${district} / ${thana}`,
      `Product: ${product_name}`,
      `Qty: ${quantity}`,
      `Total: BDT ${total.toFixed(2)}`,
    ].join('\n'),
  );

  return NextResponse.json({
    success: true,
    order_id: orderId,
    message: 'Order received',
    request_id: randomUUID(),
  });
}
