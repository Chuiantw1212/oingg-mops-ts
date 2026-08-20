// 部分 MOPS 非官方 HTML 端點（t05st05、t47sb12 等）是多步驟請求（Step1 查清單、Step2 查明細），
// 伺服器會下發 session cookie，同一批多步驟請求應共用同一個 session，避免被視為異常流量。
// 不使用額外的 cookie jar 套件——這裡只需要在單次呼叫序列內記住單一 session cookie 字串，手動處理最簡單。
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface MopsCookieClient {
  post: (body: URLSearchParams) => Promise<string>;
}

export const createMopsCookieClient = (url: string, referer: string): MopsCookieClient => {
  let cookie: string | undefined;

  const post = async (body: URLSearchParams): Promise<string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: referer,
      'User-Agent': USER_AGENT,
    };
    if (cookie) headers['Cookie'] = cookie;

    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
      throw new Error(`MOPS ${url} 回應非 200：${response.status}`);
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

  return { post };
};
