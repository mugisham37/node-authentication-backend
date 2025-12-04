import type {
  ISMSService,
  SendSMSInput,
  SendVerificationCodeInput,
  SendMFACodeInput,
  SendSecurityAlertSMSInput,
} from '../../../application/services/sms.service.js';
import { CircuitBreaker } from '../../resilience/circuit-breaker.js';
import { log as logger } from '../../logging/logger.js';

/**
 * SMS service wrapper with circuit breaker protection
 */
export class SMSServiceWithCircuitBreaker implements ISMSService {
  private circuitBreaker: CircuitBreaker;

  constructor(private readonly smsService: ISMSService) {
    this.circuitBreaker = new CircuitBreaker('sms-service', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
    });

    logger.info('SMS service with circuit breaker initialized');
  }

  async sendSMS(input: SendSMSInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.smsService.sendSMS(input));
  }

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.smsService.sendVerificationCode(input));
  }

  async sendMFACode(input: SendMFACodeInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.smsService.sendMFACode(input));
  }

  async sendSecurityAlert(input: SendSecurityAlertSMSInput): Promise<void> {
    return this.circuitBreaker.execute(() => this.smsService.sendSecurityAlert(input));
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    return this.smsService.validatePhoneNumber(phoneNumber);
  }

  getCircuitBreakerMetrics(): ReturnType<CircuitBreaker['getMetrics']> {
    return this.circuitBreaker.getMetrics();
  }
}
