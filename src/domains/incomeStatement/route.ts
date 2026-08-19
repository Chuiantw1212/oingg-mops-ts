import { Router } from 'ultimate-express';
import { postIncomeStatement } from './controller.js';

const router = Router();

// 建立 POST /income-statement 路由
router.post('/income-statement', postIncomeStatement);

export default router;