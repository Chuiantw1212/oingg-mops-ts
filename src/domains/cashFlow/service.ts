import { CashFlowPayload } from './types';

const MOPS_API_URL = 'https://mops.twse.com.tw/mops/api/t164sb05';

export const fetchCashFlow = async (payload: CashFlowPayload) => {
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
    console.error('Error fetching cash flow statement:', error);
    throw error; // 將錯誤向上拋出，由 controller 處理
  }
};
