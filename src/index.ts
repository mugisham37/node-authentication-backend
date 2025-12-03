import { buildApp, startServer, gracefulShutdown } from './app.js';
import { logger } from './shared/logging/logger.js';
import { initializeTracing, shutdownTracing } from './core/monitoring/tracing.js';

async function main() {
  try {
    // Initialize distributed tracing (Requirement 22.3)
    initializeTracing();
    logger.info('Distributed tracing initialized');

    logger.info('Starting Enterprise Authentication System...');

    const app = await buildApp();
    await startServer(app);

    // Handle graceful shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach((signal) => {
      process.on(signal, () => gracefulShutdown(app));
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      gracefulShutdown(app);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown(app);
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

void main();
