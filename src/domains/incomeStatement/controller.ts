import { Request, Response, NextFunction } from 'ultimate-express';
import { fetchIncomeStatement } from './service';
import { IncomeStatementPayload } from './types';

export const postIncomeStatement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload: IncomeStatementPayload = req.body;

    // 進行基本驗證，確保必要欄位存在
    if (!payload.companyId || !payload.dataType || !payload.season || !payload.year) {
      return res.status(400).json({ message: 'Missing required fields: companyId, dataType, season, year' });
    }

    const data = await fetchIncomeStatement(payload);
    res.status(200).json(data);
  } catch (error) {
    next(error); // 將錯誤傳遞給全域錯誤處理中介軟體
  }
};