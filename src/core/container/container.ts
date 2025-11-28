import { createContainer, asClass, asValue, InjectionMode } from 'awilix';
import type { AwilixContainer } from 'awilix';

// Define container interface for type safety
export interface DIContainer {
  // Database
  db: unknown;
  redis: unknown;

  // Repositories (will be registered with SCOPED lifetime)
  // userRepository: IUserRepository;
  // sessionRepository: ISessionRepository;
  // roleRepository: IRoleRepository;
  // permissionRepository: IPermissionRepository;
  // auditLogRepository: IAuditLogRepository;
  // deviceRepository: IDeviceRepository;
  // webhookRepository: IWebhookRepository;

  // Services (will be registered with SINGLETON lifetime)
  // authenticationService: IAuthenticationService;
  // authorizationService: IAuthorizationService;
  // tokenService: ITokenService;
  // mfaService: IMFAService;
  // sessionService: ISessionService;
  // emailService: IEmailService;
  // smsService: ISMSService;
  // rateLimitService: IRateLimitService;
  // webhookDeliveryService: IWebhookDeliveryService;
  // riskAssessmentService: IRiskAssessmentService;
  // deviceService: IDeviceService;
  // auditLogService: IAuditLogService;

  // Use cases (will be registered with TRANSIENT lifetime)
  // registerUserUseCase: RegisterUserUseCase;
  // loginUserUseCase: LoginUserUseCase;
  // verifyEmailUseCase: VerifyEmailUseCase;
  // enableMFAUseCase: EnableMFAUseCase;
  // refreshTokenUseCase: RefreshTokenUseCase;
  // assignRoleUseCase: AssignRoleUseCase;
  // createWebhookUseCase: CreateWebhookUseCase;
}

/**
 * Create and configure the dependency injection container
 */
export function buildContainer(): AwilixContainer<DIContainer> {
  const container = createContainer<DIContainer>({
    injectionMode: InjectionMode.PROXY,
  });

  // Register database connections as singletons
  // These will be registered when database setup is complete
  // container.register({
  //   db: asValue(dbConnection),
  //   redis: asValue(redisConnection),
  // });

  // Register repositories with SCOPED lifetime
  // Scoped means a new instance per request/operation
  // container.register({
  //   userRepository: asClass(UserRepository).scoped(),
  //   sessionRepository: asClass(SessionRepository).scoped(),
  //   roleRepository: asClass(RoleRepository).scoped(),
  //   permissionRepository: asClass(PermissionRepository).scoped(),
  //   auditLogRepository: asClass(AuditLogRepository).scoped(),
  //   deviceRepository: asClass(DeviceRepository).scoped(),
  //   webhookRepository: asClass(WebhookRepository).scoped(),
  // });

  // Register services with SINGLETON lifetime
  // Singleton means one instance for the entire application
  // container.register({
  //   authenticationService: asClass(AuthenticationService).singleton(),
  //   authorizationService: asClass(AuthorizationService).singleton(),
  //   tokenService: asClass(TokenService).singleton(),
  //   mfaService: asClass(MFAService).singleton(),
  //   sessionService: asClass(SessionService).singleton(),
  //   emailService: asClass(EmailService).singleton(),
  //   smsService: asClass(SMSService).singleton(),
  //   rateLimitService: asClass(RateLimitService).singleton(),
  //   webhookDeliveryService: asClass(WebhookDeliveryService).singleton(),
  //   riskAssessmentService: asClass(RiskAssessmentService).singleton(),
  //   deviceService: asClass(DeviceService).singleton(),
  //   auditLogService: asClass(AuditLogService).singleton(),
  // });

  // Register use cases with TRANSIENT lifetime
  // Transient means a new instance every time it's requested
  // container.register({
  //   registerUserUseCase: asClass(RegisterUserUseCase).transient(),
  //   loginUserUseCase: asClass(LoginUserUseCase).transient(),
  //   verifyEmailUseCase: asClass(VerifyEmailUseCase).transient(),
  //   enableMFAUseCase: asClass(EnableMFAUseCase).transient(),
  //   refreshTokenUseCase: asClass(RefreshTokenUseCase).transient(),
  //   assignRoleUseCase: asClass(AssignRoleUseCase).transient(),
  //   createWebhookUseCase: asClass(CreateWebhookUseCase).transient(),
  // });

  return container;
}

// Global container instance
let containerInstance: AwilixContainer<DIContainer> | null = null;

/**
 * Get the global container instance
 */
export function getContainer(): AwilixContainer<DIContainer> {
  if (!containerInstance) {
    containerInstance = buildContainer();
  }
  return containerInstance;
}

/**
 * Reset the container (useful for testing)
 */
export function resetContainer(): void {
  if (containerInstance) {
    void containerInstance.dispose();
    containerInstance = null;
  }
}

/**
 * Register a value in the container
 */
export function registerValue<T>(name: string, value: T): void {
  const container = getContainer();
  container.register(name, asValue(value));
}

/**
 * Register a class in the container with specified lifetime
 */
export function registerClass<T>(
  name: string,
  classConstructor: new (...args: unknown[]) => T,
  lifetime: 'singleton' | 'scoped' | 'transient' = 'singleton'
): void {
  const container = getContainer();
  const registration = asClass(classConstructor);

  switch (lifetime) {
    case 'singleton':
      container.register(name, registration.singleton());
      break;
    case 'scoped':
      container.register(name, registration.scoped());
      break;
    case 'transient':
      container.register(name, registration.transient());
      break;
  }
}

/**
 * Resolve a dependency from the container
 */
export function resolve<T>(name: string): T {
  const container = getContainer();
  return container.resolve<T>(name);
}

export default {
  buildContainer,
  getContainer,
  resetContainer,
  registerValue,
  registerClass,
  resolve,
};
