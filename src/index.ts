import { buildApp, startServer, gracefulShutdown } from './app.js';
import { logger } from './infrastructure/logging/logger.js';
import { initializeTracing } from './infrastructure/monitoring/tracing.js';

async function main(): Promise<void> {
  try {
    // Initialize distributed tracing (Requirement 22.3)
    initializeTracing();
    logger.info('Distributed tracing initialized');

    logger.info('Starting Enterprise Authentication System...');

    const app = await buildApp();
    await startServer(app);

    // Handle graceful shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
    signals.forEach((signal) => {
      process.on(signal, () => {
        void gracefulShutdown(app);
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception:', error);
      void gracefulShutdown(app);
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      void gracefulShutdown(app);
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

void main();
