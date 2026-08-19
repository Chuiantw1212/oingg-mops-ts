/**
 * Programmatic configuration for the Prisma CLI.
 * This file should export a plain configuration object.
 * @see https://www.prisma.io/docs/reference/programmatic-configuration
 */
export default {
  datasources: [{
    name: 'db',
    provider: 'postgresql',
    url: {
      envValue: 'DATABASE_URL',
    },
    directUrl: {
      envValue: 'DIRECT_URL',
    },
  }, ],
};
