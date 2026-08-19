import { Router } from 'ultimate-express';
import incomeStatementRouter from './domains/incomeStatement/route';
// 如果您有其他領域的路由，也請在這裡匯入
// import someOtherRouter from './domains/someOtherDomain/route';

const router = Router();

router.use(incomeStatementRouter);
// router.use(someOtherRouter); // 註冊其他路由

export default router;