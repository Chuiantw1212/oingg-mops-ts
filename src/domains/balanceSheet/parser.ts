import { type MopsReportRow, type FieldSpec, parseAmountFields } from '../../shared/mopsReportParsing.js';

export type { MopsReportRow };

const AMOUNT_FIELD_KEYS = [
  // 資產
  'cashAndEquivalents',
  'accountsReceivable',
  'inventory',
  'currentAssets',
  'propertyPlantEquipment',
  'investmentsUnderEquityMethod',
  'intangibleAssets',
  'nonCurrentAssets',
  'totalAssets',
  // 負債
  'shortTermBorrowings',
  'accountsPayable',
  'currentLiabilities',
  'bondsPayable',
  'longTermBorrowings',
  'nonCurrentLiabilities',
  'totalLiabilities',
  // 權益
  'capitalStock',
  'capitalSurplus',
  'retainedEarnings',
  'otherEquity',
  'treasuryStock',
  'equityAttributableToParent',
  'nonControllingInterest',
  'totalEquity',
  'totalLiabilitiesAndEquity',
] as const;
type AmountFieldKey = (typeof AMOUNT_FIELD_KEYS)[number];

export type ParsedBalanceSheet = {
  [K in AmountFieldKey]: bigint | null;
} & {
  warnings: string[];
};

// key -> (可能出現的科目名稱，依優先序；MOPS 不同季度/公司偶爾用字略有差異)
const AMOUNT_FIELD_LABELS: Record<AmountFieldKey, FieldSpec> = {
  cashAndEquivalents: { labels: ['現金及約當現金'], required: true },
  accountsReceivable: { labels: ['應收帳款淨額', '應收帳款'] },
  inventory: { labels: ['存貨'] },
  currentAssets: { labels: ['流動資產合計'], required: true },
  propertyPlantEquipment: { labels: ['不動產、廠房及設備'] },
  investmentsUnderEquityMethod: { labels: ['採用權益法之投資'] },
  intangibleAssets: { labels: ['無形資產'] },
  nonCurrentAssets: { labels: ['非流動資產合計'], required: true },
  totalAssets: { labels: ['資產總額', '資產總計'], required: true },

  shortTermBorrowings: { labels: ['短期借款'] },
  accountsPayable: { labels: ['應付帳款'] },
  currentLiabilities: { labels: ['流動負債合計'], required: true },
  bondsPayable: { labels: ['應付公司債'] },
  longTermBorrowings: { labels: ['長期借款'] },
  nonCurrentLiabilities: { labels: ['非流動負債合計'], required: true },
  totalLiabilities: { labels: ['負債總額', '負債總計'], required: true },

  capitalStock: { labels: ['股本合計'] },
  capitalSurplus: { labels: ['資本公積合計'] },
  retainedEarnings: { labels: ['保留盈餘合計'] },
  otherEquity: { labels: ['其他權益合計'] },
  treasuryStock: { labels: ['庫藏股票'] },
  equityAttributableToParent: { labels: ['歸屬於母公司業主之權益合計'] },
  nonControllingInterest: { labels: ['非控制權益'] },
  totalEquity: { labels: ['權益總額', '權益總計'], required: true },
  totalLiabilitiesAndEquity: { labels: ['負債及權益總計', '負債及權益總額'], required: true },
};

export const parseBalanceSheetReport = (reportList: MopsReportRow[]): ParsedBalanceSheet => {
  const { values, warnings } = parseAmountFields(reportList, AMOUNT_FIELD_LABELS);
  return { ...values, warnings };
};
