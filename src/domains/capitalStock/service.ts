const BASE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t05st05';
const REFERER = 'https://mopsov.twse.com.tw/mops/web/t05st05';
// t05st05 對非官方高頻爬取有 IP 封鎖紀錄，務必帶正常瀏覽器 UA（見規格文件 §4）。
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`MOPS t05st05 查無公司代號 ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

export interface CapitalStockHttpClient {
  step1: (companyId: string) => Promise<string>;
  step2: (params: { typek: string; companyId: string; year: number; month: number }) => Promise<string>;
}

// t05st05 是非官方 HTML 端點（見 docs 規格文件），伺服器會下發 jcsession cookie，同一批 Step1+Step2
// 請求應共用同一個 session（同一個 client 實例內重用 cookie），避免被視為異常流量。
// 不使用額外的 cookie jar 套件——這裡只需要記住單一 session cookie 字串，手動處理最簡單。
export const createCapitalStockHttpClient = (): CapitalStockHttpClient => {
  let cookie: string | undefined;

  const request = async (body: URLSearchParams): Promise<string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: REFERER,
      'User-Agent': USER_AGENT,
    };
    if (cookie) headers['Cookie'] = cookie;

    const response = await fetch(BASE_URL, { method: 'POST', headers, body });
    if (!response.ok) {
      throw new Error(`MOPS t05st05 回應非 200：${response.status}`);
    }

    // Node 18+ 的 fetch (undici) 支援 getSetCookie() 取得未合併的原始陣列；沒有的話退回 get('set-cookie')。
    const rawSetCookie =
      typeof (response.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [response.headers.get('set-cookie')].filter((v): v is string => v !== null);
    if (rawSetCookie.length > 0) {
      // 只取每個 Set-Cookie 的「名=值」段（第一個 `;` 之前），忽略 Path/HttpOnly 等屬性；多個 cookie 用 `; ` 串接。
      cookie = rawSetCookie.map((c) => c.split(';')[0]!.trim()).join('; ');
    }

    return await response.text();
  };

  return {
    step1: (companyId) =>
      request(
        new URLSearchParams({
          step: '1',
          firstin: 'true',
          off: '1',
          queryName: 'co_id',
          inpuType: 'co_id',
          TYPEK: 'all',
          co_id: companyId,
        })
      ),
    step2: ({ typek, companyId, year, month }) =>
      request(
        new URLSearchParams({
          step: '2',
          TYPEK: typek,
          co_id: companyId,
          off: '1',
          year: String(year),
          month: String(month),
          colorchg: '',
          firstin: 'true',
        })
      ),
  };
};
