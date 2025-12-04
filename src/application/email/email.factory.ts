import { Redis } from 'ioredis';
import { EmailService } from './email.service.impl.js';
import {
  NodemailerProvider,
  NodemailerConfig,
} from '../../shared/mail/providers/nodemailer-provider.js';
import { TemplateService } from '../services/template.service.js';
import { EmailQueue } from '../../infrastructure/queue/email-queue.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface EmailServiceConfig {
  nodemailer: NodemailerConfig;
  useQueue?: boolean;
}

export class EmailServiceFactory {
  static create(config: EmailServiceConfig, redisConnection: Redis): EmailService {
    const nodemailerProvider = new NodemailerProvider(config.nodemailer);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const templateService = new TemplateService(baseUrl);

    // First create EmailService (needed by EmailQueue)
    const emailService = new EmailService(nodemailerProvider, templateService, null);

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
