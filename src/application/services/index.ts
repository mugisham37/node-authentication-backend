export {
  AuthenticationService,
  type IAuthenticationService,
  type RegisterInput,
  type RegisterOutput,
  type LoginInput,
  type LoginOutput,
  type VerifyEmailInput,
  type RequestPasswordResetInput,
  type RequestPasswordResetOutput,
  type ResetPasswordInput,
} from './authentication.service.js';

export {
  MFAService,
  type IMFAService,
  type SetupTOTPInput,
  type SetupTOTPOutput,
  type SetupSMSInput,
  type SetupSMSOutput,
  type VerifyMFASetupInput,
  type DisableMFAInput,
  type VerifyMFALoginInput,
  type VerifyMFALoginOutput,
} from './mfa.service.js';

export {
  TokenService,
  type ITokenService,
  type TokenPayload,
  type TokenPair,
  type RefreshOutput,
} from './token.service.js';

export {
  SessionService,
  type ISessionService,
  type CreateSessionInput,
  type SessionOutput,
  type SessionListOutput,
} from './session.service.js';

export {
  OAuthService,
  type IOAuthService,
  type OAuthProviderConfig,
  type OAuthProfile,
  type GenerateAuthUrlInput,
  type GenerateAuthUrlOutput,
  type HandleCallbackInput,
  type HandleCallbackOutput,
} from './oauth.service.js';

export {
  PasswordlessService,
  type IPasswordlessService,
  type RequestMagicLinkInput,
  type RequestMagicLinkOutput,
  type VerifyMagicLinkInput,
  type VerifyMagicLinkOutput,
  type RegisterWebAuthnCredentialInput,
  type RegisterWebAuthnCredentialOutput,
  type AuthenticateWithWebAuthnInput,
  type AuthenticateWithWebAuthnOutput,
} from './passwordless.service.js';

export { AuthorizationService, type IAuthorizationService } from './authorization.service.js';

export { SystemRolesService } from './system-roles.service.js';

export {
  AuditLogService,
  type IAuditLogService,
  type CreateAuditLogInput,
  type SecurityAlert,
  type AuditLogQueryResult,
} from './audit-log.service.js';

export {
  RiskAssessmentService,
  type IRiskAssessmentService,
  type LoginAttempt,
  type RiskAssessment,
  type AlertSeverity,
} from './risk-assessment.service.js';

export {
  DeviceService,
  type IDeviceService,
  type RegisterDeviceInput,
  type RegisterDeviceOutput,
  type DeviceListItem,
} from './device.service.js';

export {
  type IEmailService,
  type SendEmailInput,
  type VerificationEmailInput,
  type PasswordResetEmailInput,
  type SecurityAlertEmailInput,
  type WelcomeEmailInput,
} from './email.service.js';

export { type ISMSService, type SendSMSInput } from './sms.service.js';

export {
  type IRateLimitService,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit.service.js';

export {
  type IWebhookDeliveryService,
  type WebhookEvent,
  type WebhookDeliveryResult,
} from './webhook-delivery.service.js';
