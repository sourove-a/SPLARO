import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';

@Processor('notifications')
@Injectable()
export class NotificationProcessor {
  
  @Process('sendOrderEmail')
  async handleOrderEmail(job: Job) {
    const { email, orderNumber, total } = job.data;
    
    console.log(`[Queue] Processing Order Email for ${orderNumber}...`);
    
    // In production, integrate with SendGrid, Postmark or Amazon SES
    // await this.mailProvider.send({
    //   to: email,
    //   template: 'order_success',
    //   context: { orderNumber, total }
    // });
    
    return { status: 'SENT' };
  }

  @Process('sendSmsAlert')
  async handleSmsAlert(job: Job) {
    const { phone, message } = job.data;
    console.log(`[Queue] Dispatching SMS to ${phone}: ${message}`);
    // Integration with Twilio or local SMS gateways (e.g., SSLWireless)
  }
}
