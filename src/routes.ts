import { Router } from 'ultimate-express';
import rootRouter from './shared/root.js';
import incomeStatementRouter from './domains/incomeStatement/route.js';
import balanceSheetRouter from './domains/balanceSheet/route.js';
import cashFlowRouter from './domains/cashFlow/route.js';

const router = Router();

// --- System & Root Routes ---
router.use(rootRouter);

// --- API Routes ---
const apiRouter = Router();
apiRouter.use(incomeStatementRouter);
apiRouter.use(balanceSheetRouter);
apiRouter.use(cashFlowRouter);

router.use('/api/ingest', apiRouter);

export default router;