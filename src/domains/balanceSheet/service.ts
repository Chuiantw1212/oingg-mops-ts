import { BalanceSheetPayload } from './types.js';

const MOPS_API_URL = 'https://mops.twse.com.tw/mops/api/t164sb03';

export const fetchBalanceSheet = async (payload: BalanceSheetPayload) => {
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
    console.error('Error fetching balance sheet:', error);
    throw error; // 將錯誤向上拋出，由 controller 處理
  }
};
