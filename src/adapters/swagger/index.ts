import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../../shared/config';

// Since this is an ES Module, __dirname is not available.
// We can recreate it using import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// glob (used internally by swagger-jsdoc) treats `\` as an escape character, so
// Windows-style paths from `join()` silently match zero files there. Normalize to `/`.
const toGlobPath = (...segments: string[]) => join(...segments).split('\\').join('/');

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OINGG MOPS API',
      version: '1.0.0', // You might want to pull this from package.json
      description: 'API documentation for the OINGG MOPS service',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
  },
  // Path to the API docs. It's crucial to use absolute paths created with `join`.
  apis: [
    toGlobPath(__dirname, '../../domains/**/*.ts'),
    toGlobPath(__dirname, '../../shared/**/*.ts'),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
export { swaggerUi };