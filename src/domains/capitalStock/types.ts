export interface CapitalStockHistoryPayload {
  companyId: string;
  /** true 時即使資料庫已有該筆變更紀錄也強制重新向 MOPS 抓取並覆蓋。 */
  force?: boolean;
}

/** Step1 清單裡的一筆「變更公司執照時間」（西元年月，來自 onclick 屬性，見規格文件）。 */
export interface CapitalStockChangeEvent {
  year: number; // 西元
  month: number; // 1-12
}

export interface CapitalStockStep1Result {
  typek: string;
  /** 全部歷史（尚未依近 5 年篩選），依 MOPS 原始順序。 */
  events: CapitalStockChangeEvent[];
}

/** Step2 明細表格解析出的原始欄位（金額欄位已轉 bigint/number，日期類欄位保留原始字串）。 */
export interface CapitalStockStep2Detail {
  parValue: number | null;
  licenseChangeYear: number | null; // 民國
  licenseChangeMonth: number | null;
  authorizedShares: bigint | null;
  authorizedCapital: bigint | null;
  paidInShares: bigint | null;
  paidInCapital: bigint | null;
  sourceInitialCapital: bigint | null;
  sourceCashIncrease: bigint | null;
  sourceCapitalReserveTransfer: bigint | null;
  sourceRetainedEarningsTransfer: bigint | null;
  capitalReserveApprovalDate: string | null;
  retainedEarningsApprovalDate: string | null;
  sourceMergerIncrease: bigint | null;
  sourceCapitalReduction: bigint | null;
  mergerApprovalDate: string | null;
  capitalReductionApprovalDate: string | null;
  sourceOther: string | null;
  nonCashContribution: string | null;
  remarks: string | null;
}
