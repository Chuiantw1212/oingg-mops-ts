import { Router } from 'ultimate-express';
import healthzRouter from './domains/system/route.js';
import rootRouter from './shared/root.js';
import incomeStatementRouter from './domains/incomeStatement/route.js';

const router = Router();

// --- System & Root Routes ---
router.use(rootRouter);
router.use(healthzRouter);

// --- API Routes ---
const apiRouter = Router();
apiRouter.use(incomeStatementRouter);

router.use('/api/ingest', apiRouter);

export default router;