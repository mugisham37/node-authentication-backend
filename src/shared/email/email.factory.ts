import { Redis } from 'ioredis';
import { EmailService } from './email.service.impl.js';
import { NodemailerProvider, NodemailerConfig } from '../mail/providers/nodemailer-provider.js';
import { TemplateRenderer } from '../mail/providers/template-renderer.js';
import { EmailQueue } from '../queue/email-queue.js';
import { logger } from '../logging/logger.js';

export interface EmailServiceConfig {
  nodemailer: NodemailerConfig;
  useQueue?: boolean;
}

export class EmailServiceFactory {
  static create(config: EmailServiceConfig, redisConnection: Redis): EmailService {
    const nodemailerProvider = new NodemailerProvider(config.nodemailer);
    const templateRenderer = new TemplateRenderer();

    // First create EmailService (needed by EmailQueue)
    const emailService = new EmailService(nodemailerProvider, templateRenderer, null);

    // Create EmailQueue with the service
    const emailQueue = new EmailQueue(redisConnection, emailService);

    // Now set the queue reference in the service
    emailService.setEmailQueue(emailQueue);

    // Start the email worker to process queued jobs
    if (config.useQueue ?? true) {
      emailQueue.startWorker();
      logger.info('Email queue worker started');
    }

    return emailService;
  }
}
