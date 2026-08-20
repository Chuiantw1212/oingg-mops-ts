import { createMopsCookieClient } from '../../shared/mopsCookieClient';

const BASE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t47sb12';
const REFERER = 'https://mopsov.twse.com.tw/mops/web/t47sb12';

export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`MOPS t47sb12 查無公司代號 ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

export interface PreferredStockHttpClient {
  step1: (params: { companyId: string; typek: string }) => Promise<string>;
  step2: (params: { preferredStockCode: string; seriesNo: number; name: string; typek: string }) => Promise<string>;
}

// Step1：查某公司底下所有特別股（各版本）清單。Step2：查單一版本的權利明細。
// 跟 capitalStock 的 t05st05 同一種「Step1 拿清單 + Step2 逐筆查明細」模式，共用同一套 cookie session client。
export const createPreferredStockHttpClient = (): PreferredStockHttpClient => {
  const client = createMopsCookieClient(BASE_URL, REFERER);

  return {
    step1: ({ companyId, typek }) =>
      client.post(
        new URLSearchParams({
          encodeURIComponent: '1',
          step: '1',
          firstin: 'true',
          TYPEK: typek,
          co_id: companyId,
        })
      ),
    step2: ({ preferredStockCode, seriesNo, name, typek }) =>
      client.post(
        new URLSearchParams({
          encodeURIComponent: '1',
          step: '2',
          firstin: 'true',
          TYPEK: typek,
          colorchg: '',
          co_id: preferredStockCode,
          seq_no: String(seriesNo),
          name,
        })
      ),
  };
};
