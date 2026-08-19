import 'dotenv/config'; // Load environment variables from .env file

const startTime = process.hrtime(); // Start timing before any other imports

import express from 'ultimate-express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { connectDb } from './adapters/prisma';
import { swaggerUi, swaggerSpec } from './adapters/swagger';
import { config } from './shared/config';
import { setStartupTime } from './shared/serverInfo';
import routes from './routes/index';
import errorHandler from './shared/errorHandler';

const app = express();

// --- Middleware ---
app.use(helmet()); // Apply basic security headers
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging - only in development
if (!config.isProduction) {
  app.use(morgan('dev'));
}

// --- API Docs ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- Routes ---
app.use(routes);

// --- Error Handler ---
// This must be the last piece of middleware to catch all errors. [15]
app.use(errorHandler);

// --- Server Start ---
const startServer = async () => {
  try {
    await connectDb(); // 在伺服器啟動時連線到資料庫
    const host = config.isProduction ? '0.0.0.0' : 'localhost';
    const port = Number(config.port);
    app.listen(port, host, () => {
      const endTime = process.hrtime(startTime);
      const startupTimeInMs = (endTime[0] * 1e9 + endTime[1]) / 1e6;
      setStartupTime(startupTimeInMs);

      console.log(`[server]: Server is running at http://${host}:${port}`);
      if (!config.isProduction) {
        console.log(`[server]: Server started in ${startupTimeInMs.toFixed(2)}ms`);
        console.log(`[server]: API docs available at http://localhost:${port}/api-docs`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};
startServer();