import { PrismaClient } from '@prisma/client';
import { log } from '../../logging/logger.js';

let prisma: PrismaClient | null = null;

export function initializePrisma(): PrismaClient {
  if (prisma) {
    log.warn('Prisma client already initialized');
    return prisma;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  log.info('Prisma client initialized');

  return prisma;
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client not initialized. Call initializePrisma() first.');
  }
  return prisma;
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
