import { createMopsCookieClient } from '../../shared/mopsCookieClient';

const BASE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t05st05';
const REFERER = 'https://mopsov.twse.com.tw/mops/web/t05st05';
// t05st05 對非官方高頻爬取有 IP 封鎖紀錄，務必帶正常瀏覽器 UA（見規格文件 §4，UA 已內建在 mopsCookieClient）。

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

export const createCapitalStockHttpClient = (): CapitalStockHttpClient => {
  const client = createMopsCookieClient(BASE_URL, REFERER);

  return {
    step1: (companyId) =>
      client.post(
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
      client.post(
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
