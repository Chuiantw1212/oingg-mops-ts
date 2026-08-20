const BASE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t108sb27';
const REFERER = 'https://mopsov.twse.com.tw/mops/web/t108sb27';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// t108sb27（公司股利分派公告資料彙總表）是單次請求就回傳整年資料的非官方 HTML 端點，不像 t05st05
// 需要兩段式 + session cookie，所以這裡不需要 capitalStock/service.ts 那種手動 cookie jar。
export const fetchDividendDistribution = async (params: { companyId: string; year: string; typek: string }): Promise<string> => {
  const body = new URLSearchParams({
    encodeURIComponent: '1',
    step: '1',
    firstin: '1',
    off: '1',
    keyword4: '',
    code1: '',
    TYPEK2: '',
    checkbtn: '',
    queryName: '',
    TYPEK: params.typek,
    co_id_1: params.companyId,
    co_id_2: params.companyId,
    year: params.year,
    month: '',
    b_date: '',
    e_date: '',
    type: '',
  });

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: REFERER,
      'User-Agent': USER_AGENT,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`MOPS t108sb27 回應非 200：${response.status}`);
  }

  return await response.text();
};
