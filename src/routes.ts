import { Router } from 'ultimate-express';
import rootRouter from './domains/system/root';
import incomeStatementRouter from './domains/incomeStatement/route';
import balanceSheetRouter from './domains/balanceSheet/route';
import cashFlowRouter from './domains/cashFlow/route';
import quarterlyReportRouter from './domains/quarterlyReport/route';
import reconciliationRouter from './domains/reconciliation/route';
import capitalStockRouter from './domains/capitalStock/route';
import dividendRouter from './domains/dividend/route';
import cpiRouter from './domains/cpi/route';
import preferredStockRouter from './domains/preferredStock/route';

const router = Router();

// --- System & Root Routes ---
router.use(rootRouter);

// --- API Routes ---
const apiRouter = Router();
apiRouter.use(incomeStatementRouter);
apiRouter.use(balanceSheetRouter);
apiRouter.use(cashFlowRouter);
apiRouter.use(quarterlyReportRouter);
apiRouter.use(capitalStockRouter);
apiRouter.use(dividendRouter);
apiRouter.use(cpiRouter);
apiRouter.use(preferredStockRouter);

router.use('/api/ingest', apiRouter);

// reconciliation 只讀資料庫既有資料做交叉驗證，不屬於「向 MOPS 抓取並寫入」的 ingest 語意，故不掛在 /api/ingest 下。
router.use('/api', reconciliationRouter);

export default router;