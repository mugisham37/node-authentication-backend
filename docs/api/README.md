# Enterprise Authentication System API Documentation

## Overview

The Enterprise Authentication System provides a comprehensive REST API for authentication, authorization, and user management. This document provides detailed information about API usage, authentication flows, error handling, and best practices.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.example.com`

All API endpoints are versioned and prefixed with `/api/v1/`.

## Interactive Documentation

Interactive API documentation is available via Swagger UI:

- **Development**: http://localhost:3000/docs
- **Production**: https://api.example.com/docs

The Swagger UI provides:
- Complete endpoint documentation with request/response schemas
- Interactive API testing ("Try it out" feature)
- Authentication support
- Example requests and responses
- Error code documentation

## Authentication

### Overview

The API uses JWT (JSON Web Token) based authentication with access and refresh tokens:

- **Access Token**: Short-lived token (15 minutes) for API requests
- **Refresh Token**: Long-lived token (7 days) for obtaining new access tokens

### Authentication Flow

1. **Register or Login**: Obtain access and refresh tokens
2. **Make API Requests**: Include access token in Authorization header
3. **Token Refresh**: Use refresh token to get new access token before expiration
4. **Logout**: Revoke tokens and terminate session

### Using Access Tokens

Include the access token in the `Authorization` header of all authenticated requests:

```http
Authorization: Bearer <access_token>
```

Example:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.example.com/api/v1/auth/me
```

### Token Refresh

When an access token expires (401 error), use the refresh token to obtain a new one:

```bash
curl -X POST https://api.example.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "your_refresh_token"}'
```

**Important**: The old refresh token is invalidated when a new one is issued (token rotation).

## Authentication Flows

### 1. Email/Password Registration

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "image": "https://example.com/avatar.jpg"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Next Steps**:
1. User receives verification email
2. User clicks verification link
3. Email is marked as verified

### 2. Email/Password Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "mfaEnabled": false
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6...",
  "session": {
    "id": "uuid",
    "deviceName": "Chrome on Windows",
    "trustScore": 85
  }
}
```

### 3. Multi-Factor Authentication (MFA) Flow

If MFA is enabled, login returns a challenge instead of tokens:

**Login Response** (200 OK):
```json
{
  "mfaRequired": true,
  "challengeId": "ch_1234567890"
}
```

**Verify MFA Code**:
```bash
POST /api/v1/auth/mfa/verify
Content-Type: application/json

{
  "challengeId": "ch_1234567890",
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "...",
  "session": { ... }
}
```

### 4. Passwordless Authentication (Magic Link)

**Request Magic Link**:
```bash
POST /api/v1/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "message": "Magic link sent to email"
}
```

User clicks link in email, which redirects to:
```
GET /api/v1/auth/magic-link/verify?token=<token>
```

### 5. OAuth/Social Authentication

**Initiate OAuth Flow**:
```bash
GET /api/v1/oauth/google/authorize
```

Redirects to Google OAuth consent screen. After authorization, Google redirects back to:
```
GET /api/v1/oauth/google/callback?code=<auth_code>&state=<state>
```

**Response**: Redirects to frontend with tokens in URL or sets cookies.

### 6. Password Reset Flow

**Request Reset**:
```bash
POST /api/v1/auth/password/forgot
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Reset Password**:
```bash
POST /api/v1/auth/password/reset
Content-Type: application/json

{
  "token": "rt_1234567890abcdef",
  "password": "NewSecurePass123!"
}
```

## Rate Limiting

All endpoints are rate-limited to prevent abuse. Rate limits vary by endpoint:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| Password Reset | 5 requests | 1 minute |
| Registration | 3 requests | 5 minutes |
| MFA Verification | 1 request | 10 seconds |
| General API | 100 requests | 1 minute |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640000000
```

When rate limit is exceeded (429 error):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": {
    "type": "RateLimitError",
    "message": "Rate limit exceeded",
    "details": {
      "retryAfter": 60
    },
    "requestId": "uuid"
  }
}
```

## Error Handling

### Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "type": "ErrorType",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "uuid"
  }
}
```

### HTTP Status Codes

| Code | Type | Description |
|------|------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data (ValidationError) |
| 401 | Unauthorized | Invalid or missing authentication (AuthenticationError) |
| 403 | Forbidden | Insufficient permissions (AuthorizationError) |
| 404 | Not Found | Resource not found (NotFoundError) |
| 409 | Conflict | Resource already exists (ConflictError) |
| 429 | Too Many Requests | Rate limit exceeded (RateLimitError) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Types

#### ValidationError (400)

Request data failed validation:

```json
{
  "error": {
    "type": "ValidationError",
    "message": "Request validation failed",
    "details": {
      "body": [
        {
          "path": "email",
          "message": "Invalid email format"
        },
        {
          "path": "password",
          "message": "Password must be at least 8 characters"
        }
      ]
    },
    "requestId": "uuid"
  }
}
```

#### AuthenticationError (401)

Invalid or missing authentication:

```json
{
  "error": {
    "type": "AuthenticationError",
    "message": "Invalid credentials",
    "requestId": "uuid"
  }
}
```

#### AuthorizationError (403)

Insufficient permissions:

```json
{
  "error": {
    "type": "AuthorizationError",
    "message": "Insufficient permissions",
    "details": {
      "required": "admin",
      "actual": "user"
    },
    "requestId": "uuid"
  }
}
```

## Pagination

List endpoints support pagination via query parameters:

```bash
GET /api/v1/admin/users?page=2&limit=20&sortBy=createdAt&sortOrder=desc
```

**Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc` (default: `asc`)

**Response**:
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Webhooks

### Creating Webhooks

```bash
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/webhook",
  "events": ["user.registered", "user.login", "password.changed"],
  "description": "Production webhook"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "url": "https://example.com/webhook",
  "events": ["user.registered", "user.login", "password.changed"],
  "secret": "whsec_1234567890abcdef",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Webhook Payload

When an event occurs, a POST request is sent to your webhook URL:

```http
POST https://example.com/webhook
Content-Type: application/json
X-Webhook-Signature: sha256=<hmac_signature>
X-Webhook-Event: user.registered
X-Webhook-ID: uuid
X-Webhook-Timestamp: 1640000000

{
  "event": "user.registered",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Verifying Webhook Signatures

Verify the webhook signature to ensure authenticity:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

### Webhook Retry Logic

Failed webhook deliveries are retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 minute later
- Attempt 3: 5 minutes later
- Attempt 4: 15 minutes later
- Attempt 5: 1 hour later

After 5 failed attempts, the webhook delivery is marked as failed.

## Security Best Practices

### 1. Token Storage

- **Never** store tokens in localStorage (vulnerable to XSS)
- Use httpOnly cookies or secure in-memory storage
- Implement token refresh before expiration

### 2. HTTPS Only

- Always use HTTPS in production
- Never send tokens over unencrypted connections

### 3. Token Rotation

- Refresh tokens are rotated on each use
- Old refresh tokens are immediately invalidated
- Detected token reuse revokes entire token family

### 4. Rate Limiting

- Implement client-side rate limiting
- Handle 429 errors gracefully with exponential backoff
- Respect `Retry-After` header

### 5. Error Handling

- Never expose sensitive information in errors
- Log `requestId` for debugging
- Implement proper error recovery

### 6. Input Validation

- Validate all input on client side
- Server performs additional validation
- Follow password complexity requirements

## Code Examples

### JavaScript/TypeScript

```typescript
class AuthClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private baseURL = 'https://api.example.com/api/v1';

  async register(email: string, password: string, name: string) {
    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      throw await response.json();
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    return data;
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 401) {
      // Token expired, refresh and retry
      await this.refresh();
      return this.makeAuthenticatedRequest(endpoint, options);
    }

    return response;
  }

  async refresh() {
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, user needs to login again
      this.accessToken = null;
      this.refreshToken = null;
      throw new Error('Session expired');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
  }
}
```

### Python

```python
import requests
from typing import Optional

class AuthClient:
    def __init__(self, base_url: str = "https://api.example.com/api/v1"):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None

    def register(self, email: str, password: str, name: str) -> dict:
        response = requests.post(
            f"{self.base_url}/auth/register",
            json={"email": email, "password": password, "name": name}
        )
        response.raise_for_status()
        
        data = response.json()
        self.access_token = data["accessToken"]
        self.refresh_token = data["refreshToken"]
        return data

    def make_authenticated_request(self, endpoint: str, method: str = "GET", **kwargs) -> requests.Response:
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token}"
        kwargs["headers"] = headers

        response = requests.request(method, f"{self.base_url}{endpoint}", **kwargs)

        if response.status_code == 401:
            # Token expired, refresh and retry
            self.refresh()
            return self.make_authenticated_request(endpoint, method, **kwargs)

        return response

    def refresh(self):
        response = requests.post(
            f"{self.base_url}/auth/refresh",
            json={"refreshToken": self.refresh_token}
        )
        
        if not response.ok:
            # Refresh failed, user needs to login again
            self.access_token = None
            self.refresh_token = None
            raise Exception("Session expired")

        data = response.json()
        self.access_token = data["accessToken"]
        self.refresh_token = data["refreshToken"]
```

## Versioning

The API uses URL-based versioning: `/api/v1/`, `/api/v2/`, etc.

### Version Support Policy

- Current version: **v1**
- Supported versions: **v1**
- Deprecated versions: None

### Breaking Changes

Breaking changes will result in a new API version. Examples of breaking changes:
- Removing or renaming endpoints
- Changing request/response formats
- Removing required fields
- Changing authentication mechanisms

### Non-Breaking Changes

Non-breaking changes are made to the current version:
- Adding new endpoints
- Adding optional fields
- Adding new response fields
- Bug fixes and performance improvements

## Support

For API support:
- Email: support@example.com
- Documentation: https://docs.example.com
- Status Page: https://status.example.com

## Changelog

### v1.0.0 (2024-01-01)

- Initial API release
- Authentication endpoints
- MFA support
- OAuth integration
- Session management
- Webhook support
- Admin endpoints
