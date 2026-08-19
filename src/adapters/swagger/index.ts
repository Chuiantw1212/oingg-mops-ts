import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../../shared/config.js';

// Since this is an ES Module, __dirname is not available.
// We can recreate it using import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    join(__dirname, '../../domains/**/*.ts'),
    join(__dirname, '../../shared/**/*.ts'),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
export { swaggerUi };