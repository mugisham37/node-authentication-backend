# Contributing to Enterprise Authentication System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Create a feature branch: `git checkout -b feat/your-feature-name`
4. Make your changes
5. Run tests: `npm test`
6. Commit your changes using conventional commits
7. Push to your fork: `git push origin feat/your-feature-name`
8. Open a Pull Request

## Development Setup

See the README.md file for detailed setup instructions.

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide explicit return types for functions
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Use type aliases for unions and complex types

### Code Style

- Follow the ESLint and Prettier configurations
- Use 2 spaces for indentation
- Use single quotes for strings
- Maximum line length: 100 characters
- Maximum function length: 50 lines
- Maximum nesting depth: 3 levels

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Use UPPER_SNAKE_CASE for constants
- Prefix booleans with is/has/should
- Use verb-noun pattern for functions (getUserById, validateEmail)

### Architecture

- Follow clean architecture layers
- Domain layer has no external dependencies
- Application layer orchestrates use cases
- Infrastructure layer implements technical concerns
- Presentation layer handles HTTP communication

### Testing

- Write unit tests for all business logic
- Write property-based tests for universal properties
- Write integration tests for database operations
- Write API tests for endpoints
- Aim for 80% code coverage minimum

### Commit Messages

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commit

Examples:
```
feat(auth): add JWT token generation
fix(user): resolve email validation bug
docs: update API documentation
test(auth): add property tests for registration
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Ensure code passes linting
5. Update CHANGELOG.md if applicable
6. Request review from maintainers

### PR Title Format

Use conventional commits format for PR titles:
```
feat(scope): description
```

### PR Description

Include:
- Summary of changes
- Related issue numbers
- Breaking changes (if any)
- Testing performed
- Screenshots (if UI changes)

## Testing Guidelines

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Focus on business logic
- Use descriptive test names

### Property-Based Tests

- Use fast-check for property testing
- Test universal properties
- Run minimum 100 iterations
- Tag tests with property numbers

### Integration Tests

- Use Testcontainers for real databases
- Test actual database behavior
- Test transactions and constraints
- Clean up after each test

### API Tests

- Use Supertest for HTTP testing
- Test complete request-response cycle
- Test authentication and authorization
- Test error responses

## Documentation

- Document public APIs with JSDoc comments
- Update README.md for user-facing changes
- Update API documentation for endpoint changes
- Add inline comments for complex logic

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user input
- Use parameterized queries
- Follow OWASP security guidelines

## Questions?

If you have questions, please:
1. Check existing documentation
2. Search existing issues
3. Open a new issue with the "question" label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
