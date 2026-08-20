export interface DividendYearPayload {
  companyId: string;
  year: string; // 民國年——篩選的是「公告/記錄」落在這個民國年的股利分派事件，不是股利所屬期間的年度
  typek: 'sii' | 'otc';
  force?: boolean;
}

// Step2 明細表格解析出的一列（僅涵蓋「適用停止過戶期間規定之公司」表格，見 parser.ts 說明）。
export interface DividendDistributionRow {
  companyName: string | null;
  dividendPeriod: string | null; // 股利所屬期間原始文字，如「113年第3季」；格式未必固定（可能有年度股利等其他格式），故保留原始字串不硬解析
  rightsRecordDate: Date; // 權利分派基準日，本表主鍵的一部分

  stockDividendFromEarnings: number | null; // 盈餘轉增資配股(元/股)
  stockDividendFromCapitalReserve: number | null; // 法定盈餘公積、資本公積轉增資配股(元/股)
  exRightsDate: Date | null; // 除權交易日

  cashDividendFromEarnings: number | null; // 盈餘分配之股東現金股利(元/股)
  cashDividendFromCapitalReserve: number | null; // 法定盈餘公積、資本公積發放之現金(元/股)
  preferredStockCashDividend: number | null; // 特別股配發現金股利(元/股)
  exDividendDate: Date | null; // 除息交易日
  cashDividendPaymentDate: Date | null; // 現金股利發放日

  capitalIncreaseShares: bigint | null; // 現金增資總股數(股)
  capitalIncreaseSubscriptionRatio: number | null; // 現金增資認股比率(%)
  capitalIncreaseSubscriptionPrice: number | null; // 現金增資認購價(元/股)

  totalParticipatingShares: bigint | null; // 參加分派總股數

  announcementDate: Date | null; // 公告日期
  announcementTime: string | null; // 公告時間（僅時分秒，不含日期，故不併入 announcementDate）

  parValue: number | null; // 普通股每股面額，從「新台幣10.0000元」這類文字抽取數字
}
