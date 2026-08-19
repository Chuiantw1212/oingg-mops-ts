/**
 * Application configuration.
 * It's recommended to read these values from environment variables.
 */
export const config = {
  isProduction: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 3000,
};