import { Redis } from 'ioredis';
import { EmailService } from './email.service.impl.js';
import {
  NodemailerProvider,
  NodemailerConfig,
} from '../../core/mail/providers/nodemailer-provider.js';
import { TemplateRenderer } from '../../core/mail/providers/template-renderer.js';
import { EmailQueue } from '../../core/queue/email-queue.js';
import { logger } from '../logging/logger.js';

export interface EmailServiceConfig {
  nodemailer: NodemailerConfig;
  useQueue?: boolean;
}

export class EmailServiceFactory {
  static create(config: EmailServiceConfig, redisConnection: Redis): EmailService {
    const nodemailerProvider = new NodemailerProvider(config.nodemailer);
    const templateRenderer = new TemplateRenderer();
    const emailQueue = new EmailQueue(redisConnection);

    const emailService = new EmailService(
      nodemailerProvider,
      templateRenderer,
      emailQueue,
      config.useQueue ?? true
    );

    // Start the email worker to process queued jobs
    if (config.useQueue ?? true) {
      emailQueue.startWorker(async (job) => {
        await nodemailerProvider.sendEmail(job.data);
      });
      logger.info('Email queue worker started');
    }

    return emailService;
  }
}
