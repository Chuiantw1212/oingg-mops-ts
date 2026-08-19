import { PrismaClient } from '@prisma/client';
import { config } from '../../shared/config.js';

// Instantiate a single PrismaClient instance to be used across the application.
export const prisma = new PrismaClient({
  // Log database queries in development for easier debugging.
  log: config.isProduction ? ['error'] : ['query', 'info', 'warn', 'error'],
});

export const connectDb = async () => {
  try {
    await prisma.$connect();
    console.log('[db]: Connected to database.');
  } catch (error) {
    console.error('[db]: Could not connect to the database.', error);
    throw error; // Re-throw to be caught by the server starter and prevent server from starting.
  }
};

export default prisma;
