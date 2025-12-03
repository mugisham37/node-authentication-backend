import type {
  IEmailService,
  SendEmailInput,
  VerificationEmailInput,
  PasswordResetEmailInput,
  SecurityAlertEmailInput,
  WelcomeEmailInput,
} from '../../application/services/email.service.js';
import { CircuitBreaker } from '../../infrastructure/resilience/circuit-breaker.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Email service wrapper with circuit breaker protection
 */
export class EmailServiceWithCircuitBreaker implements IEmailService {
  private circuitBreaker: CircuitBreaker;

  constructor(private readonly emailService: IEmailService) {
    this.circuitBreaker = new CircuitBreaker('email-service', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
    });

    logger.info('Email service with circuit breaker initialized');
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.emailService.sendEmail(input));
  }

  async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.emailService.sendVerificationEmail(input));
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.emailService.sendPasswordResetEmail(input));
  }

  async sendSecurityAlertEmail(input: SecurityAlertEmailInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.emailService.sendSecurityAlertEmail(input));
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.emailService.sendWelcomeEmail(input));
  }

  getCircuitBreakerMetrics(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    nextAttemptTime: number | null;
  } {
    return this.circuitBreaker.getMetrics();
  }
}
