import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * SMTP delivery (any provider: SES, SendGrid, Mailgun, Brevo, Gmail with an
 * app password). Without SMTP_HOST, development prints messages to the log
 * and tests keep them in memory; production refuses to boot (env validation).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  /** Test runs only: messages "sent" so far. */
  readonly outbox: MailMessage[] = [];

  constructor(private readonly config: AppConfig) {
    const host = config.get('SMTP_HOST');
    this.transport = host
      ? createTransport({
          host,
          port: config.get('SMTP_PORT'),
          secure: config.get('SMTP_SECURE'),
          ...(config.get('SMTP_USER') && { auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') } }),
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (this.transport) {
      await this.transport.sendMail({ from: this.config.get('EMAIL_FROM'), ...message });
      return;
    }
    if (this.config.get('NODE_ENV') === 'test') {
      this.outbox.push(message);
      return;
    }
    // Development only: no SMTP configured, so show the message where the developer can see it.
    this.logger.warn(`SMTP_HOST is not set; email not sent. To: ${message.to} | ${message.subject}\n${message.text}`);
  }
}
