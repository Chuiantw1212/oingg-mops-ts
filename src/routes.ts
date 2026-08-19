import { Router } from 'ultimate-express';
import rootRouter from './shared/root.js';
import incomeStatementRouter from './domains/incomeStatement/route.js';
import balanceSheetRouter from './domains/balanceSheet/route.js';
import cashFlowRouter from './domains/cashFlow/route.js';
import reconciliationRouter from './domains/reconciliation/route.js';

const router = Router();

// --- System & Root Routes ---
router.use(rootRouter);

// --- API Routes ---
const apiRouter = Router();
apiRouter.use(incomeStatementRouter);
apiRouter.use(balanceSheetRouter);
apiRouter.use(cashFlowRouter);

router.use('/api/ingest', apiRouter);

// reconciliation 只讀資料庫既有資料做交叉驗證，不屬於「向 MOPS 抓取並寫入」的 ingest 語意，故不掛在 /api/ingest 下。
router.use('/api', reconciliationRouter);

export default router;