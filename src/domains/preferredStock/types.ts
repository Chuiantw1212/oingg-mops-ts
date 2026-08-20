export interface PreferredStockRightsPayload {
  companyId: string; // 母公司股票代號，如 "2887"（不是特別股股票代號 "2887A"）
  typek: 'sii' | 'otc';
  force?: boolean;
}

// Step1 清單裡的一筆（一檔特別股的其中一個版本）。
export interface PreferredStockListEntry {
  preferredStockCode: string; // 特別股股票代號，如 "2887A"
  seriesNo: number; // 期別/序號
  preferredStockName: string;
}

// Step2 明細解析出的欄位（除了 Step1 已有的三個欄位）。
export interface PreferredStockDetail {
  issueDate: Date | null; // 發行日期
  cumulativeDividend: boolean | null; // 累積股利(是/否)
  issuePrice: number | null; // 發行價格
  // 股息：MOPS 原始欄位沒有標示單位，實測值如 "5.750"，可能是「每股金額」也可能是「百分比」，未經二次確認，先原樣存數字。
  dividendRate: number | null;

  participatingExcessDividend: boolean | null; // 參加超額股利分配(有/無)
  liquidationPreference: boolean | null; // 分配剩餘財產優先權(有/無)
  votingRights: boolean | null; // 表決權(有/無)
  eligibleForElection: boolean | null; // 被選舉權(有/無)
  convertible: boolean | null; // 轉換權(有/無)
  conversionStartDate: Date | null; // 開始轉換時間

  redeemable: boolean | null; // 是否收回(是/否)
  redemptionDate: Date | null; // 收回時間
  redemptionConditions: string | null; // 收回條件

  cashCapitalIncreaseSubscriptionRight: boolean | null; // 現金增資認購權(有/無)
  earningsCapitalizationRight: boolean | null; // 盈餘轉增資配股權(有/無)
  assetRevaluationSurplusRight: boolean | null; // 資產重估淨增值(有/無)
  assetDisposalSurplusRight: boolean | null; // 處分資產盈餘(有/無)
  commonStockPremiumRight: boolean | null; // 發行普通股溢價(有/無)

  modifiedDate: Date | null; // 修改日期
  previousSeriesNo: number | null; // 修改前次序號：指向同一 preferredStockCode 底下被這筆取代的舊版本 seriesNo
}
