import { IncomeStatementPayload } from './types.js';

const MOPS_API_URL = 'https://mops.twse.com.tw/mops/api/t164sb04';

export const fetchIncomeStatement = async (payload: IncomeStatementPayload) => {
  try {
    const response = await fetch(MOPS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        subsidiaryCompanyId: payload.subsidiaryCompanyId || '', // 確保此欄位存在
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch from MOPS API. Status: ${response.status}. Body: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching income statement:', error);
    throw error; // 將錯誤向上拋出，由 controller 處理
  }
};