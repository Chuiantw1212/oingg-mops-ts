import { Router } from 'ultimate-express';
import rootRouter from './shared/root.js';
import incomeStatementRouter from './domains/incomeStatement/route.js';
import balanceSheetRouter from './domains/balanceSheet/route.js';

const router = Router();

// --- System & Root Routes ---
router.use(rootRouter);

// --- API Routes ---
const apiRouter = Router();
apiRouter.use(incomeStatementRouter);
apiRouter.use(balanceSheetRouter);

router.use('/api/ingest', apiRouter);

export default router;