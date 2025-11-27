# Enterprise Authentication System

Production-ready, enterprise-grade authentication and authorization backend built with Node.js, TypeScript, Fastify, PostgreSQL, and Redis.

## Features

- **Multiple Authentication Methods**: Email/password, MFA (TOTP/SMS), passwordless (magic links, WebAuthn), OAuth/Social (Google, GitHub, Microsoft)
- **Sophisticated Authorization**: Role-based access control (RBAC) with permission caching
- **Security First**: Argon2id password hashing, RS256 JWT tokens, rate limiting, device fingerprinting, risk-based authentication
- **Real-time Updates**: WebSocket notifications for security events
- **Comprehensive Audit**: Immutable audit logs with risk scoring
- **Webhook Support**: Event-driven integrations with retry logic
- **High Performance**: Sub-200ms authentication, 10K+ RPS per instance
- **Production Ready**: Monitoring, logging, distributed tracing, health checks

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5+
- **Framework**: Fastify 4+
- **Database**: PostgreSQL 16+ with Drizzle ORM
- **Cache**: Redis 7+ with ioredis
- **Queue**: BullMQ for background jobs
- **Testing**: Vitest with fast-check for property-based testing
- **Monitoring**: Prometheus metrics, Winston logging, OpenTelemetry tracing

## Architecture

The system follows clean architecture principles with four distinct layers:

- **Domain Layer**: Pure business logic (entities, value objects, domain events)
- **Application Layer**: Use cases and application services
- **Infrastructure Layer**: External integrations (database, cache, email, SMS, OAuth)
- **Presentation Layer**: HTTP API with Fastify (routes, controllers, middleware)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 16
- Redis >= 7
- npm >= 10.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd enterprise-auth-system
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env` file

5. Run database migrations:
```bash
npm run db:migrate
```

6. Start development server:
```bash
npm run dev
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code
- `npm run lint:fix` - Lint and fix code
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type check without emitting

### Project Structure

```
src/
├── domain/              # Domain layer (entities, value objects, events)
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── repositories/    # Repository interfaces
├── application/         # Application layer (use cases, services)
│   ├── services/
│   ├── use-cases/
│   ├── commands/
│   └── queries/
├── infrastructure/      # Infrastructure layer (implementations)
│   ├── database/
│   ├── repositories/
│   ├── cache/
│   ├── email/
│   ├── sms/
│   ├── oauth/
│   ├── queue/
│   ├── logging/
│   └── monitoring/
├── presentation/        # Presentation layer (HTTP API)
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── validators/
│   └── websocket/
├── shared/             # Shared utilities
│   ├── errors/
│   ├── types/
│   ├── utils/
│   └── constants/
└── config/             # Configuration
```

### Testing

The project uses a dual testing approach:

- **Unit Tests**: Verify specific examples and edge cases
- **Property-Based Tests**: Verify universal properties across all inputs using fast-check
- **Integration Tests**: Test with real PostgreSQL and Redis using Testcontainers
- **API Tests**: End-to-end API testing with Supertest

Run tests:
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

### Code Quality

The project enforces code quality through:

- **TypeScript**: Strict mode enabled
- **ESLint**: Linting with TypeScript rules
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **Conventional Commits**: Standardized commit messages

## API Documentation

API documentation is available at `/docs` when the server is running.

The API follows RESTful conventions and uses:
- JWT tokens for authentication
- Role-based permissions for authorization
- Zod schemas for request validation
- Structured error responses

## Deployment

### Docker

Build and run with Docker:
```bash
docker build -t enterprise-auth-system .
docker run -p 3000:3000 enterprise-auth-system
```

### Docker Compose

Run with all dependencies:
```bash
docker-compose up
```

### Kubernetes

Deploy to Kubernetes:
```bash
kubectl apply -f deployment/kubernetes/
```

## Monitoring

The system exposes:
- Prometheus metrics at `/metrics`
- Health check at `/health`
- Structured JSON logs
- Distributed tracing with OpenTelemetry

## Security

- Argon2id password hashing with recommended parameters
- RS256 JWT tokens with key rotation
- Rate limiting on all endpoints
- Device fingerprinting and trust scoring
- Risk-based authentication
- Comprehensive audit logging
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

## License

MIT

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.
