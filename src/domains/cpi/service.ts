const BASE_URL = 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx';
// A030101015 = 消費者物價基本分類指數；"1...M." 是 SDMX 序列 key（fldid=1「總指數」, freq=M「月」，其餘維度留空取全部）。
// 這個 key 是寫死的——只抓「月度總指數」這一條序列，不是通用的 DGBAS 查詢包裝。
const SERIES_PATH = 'sdmx/A030101015/1...M.';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 公開統計資料 API（行政院主計總處），GET 請求、無需 Referer/cookie，一次請求就回傳整段時間範圍的月資料
// （SDMX-JSON 格式），不像 MOPS 那幾個 domain 需要分季/分年重複請求。
export const fetchMonthlyCpi = async (params: { startYear: number; endYear: number; endMonth: number }): Promise<unknown> => {
  const url = `${BASE_URL}?${SERIES_PATH}&startTime=${params.startYear}&endTime=${params.endYear}-M${params.endMonth}`;

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`DGBAS SDMX API 回應非 200：${response.status}`);
  }

  return await response.json();
};
