import { PrismaClient } from '@prisma/client';
import { log } from '../../logging/logger.js';

let prisma: PrismaClient | null = null;

/**
 * Initialize Prisma client
 */
export function initializePrisma(): PrismaClient {
  if (prisma) {
    log.warn('Prisma client already initialized');
    return prisma;
  }

  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Set up event listeners
  prisma.$on('query' as never, (e: any) => {
    log.debug('Prisma query', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  });

  prisma.$on('error' as never, (e: any) => {
    log.error('Prisma error', e);
  });

  prisma.$on('warn' as never, (e: any) => {
    log.warn('Prisma warning', { message: e.message });
  });

  log.info('Prisma client initialized');

  return prisma;
}

/**
 * Get the Prisma client instance
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client not initialized. Call initializePrisma() first.');
  }
  return prisma;
}

/**
 * Close the Prisma client connection
 */
export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    log.info('Prisma client disconnected');
  }
}

export default {
  initializePrisma,
  getPrisma,
  closePrisma,
};
