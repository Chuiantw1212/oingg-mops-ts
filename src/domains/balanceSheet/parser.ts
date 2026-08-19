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
// 金控/銀行/保險業的資產負債表是用「流動性」排序，不分流動/非流動，因此 currentAssets/nonCurrentAssets/
// currentLiabilities/nonCurrentLiabilities 對這類公司來說結構性不存在，不列為 required。
// 這類公司很多科目也少了「合計」二字（股本、資本公積、保留盈餘、其他權益、歸屬於母公司業主之權益），
// 或用「－淨額」後綴取代（採用權益法之投資、不動產及設備、無形資產），皆列為候選名稱。
const AMOUNT_FIELD_LABELS: Record<AmountFieldKey, FieldSpec> = {
  cashAndEquivalents: { labels: ['現金及約當現金'], required: true },
  accountsReceivable: { labels: ['應收帳款淨額', '應收帳款', '應收款項－淨額', '應收款項'] },
  inventory: { labels: ['存貨'] },
  currentAssets: { labels: ['流動資產合計'] },
  propertyPlantEquipment: { labels: ['不動產、廠房及設備', '不動產及設備－淨額', '不動產及設備合計', '不動產及設備'] },
  investmentsUnderEquityMethod: { labels: ['採用權益法之投資', '採用權益法之投資－淨額'] },
  intangibleAssets: { labels: ['無形資產', '無形資產－淨額'] },
  nonCurrentAssets: { labels: ['非流動資產合計'] },
  totalAssets: { labels: ['資產總額', '資產總計'], required: true },

  shortTermBorrowings: { labels: ['短期借款'] },
  accountsPayable: { labels: ['應付帳款', '應付款項'] },
  currentLiabilities: { labels: ['流動負債合計'] },
  bondsPayable: { labels: ['應付公司債', '應付債券', '應付金融債券'] },
  longTermBorrowings: { labels: ['長期借款'] },
  nonCurrentLiabilities: { labels: ['非流動負債合計'] },
  totalLiabilities: { labels: ['負債總額', '負債總計'], required: true },

  capitalStock: { labels: ['股本合計', '股本'] },
  capitalSurplus: { labels: ['資本公積合計', '資本公積'] },
  retainedEarnings: { labels: ['保留盈餘合計', '保留盈餘', '保留盈餘（或累積虧損）合計'] },
  otherEquity: { labels: ['其他權益合計', '其他權益'] },
  treasuryStock: { labels: ['庫藏股票'] },
  equityAttributableToParent: { labels: ['歸屬於母公司業主之權益合計', '歸屬於母公司業主之權益'] },
  nonControllingInterest: { labels: ['非控制權益'] },
  totalEquity: { labels: ['權益總額', '權益總計'], required: true },
  totalLiabilitiesAndEquity: { labels: ['負債及權益總計', '負債及權益總額'], required: true },
};

export const parseBalanceSheetReport = (reportList: MopsReportRow[]): ParsedBalanceSheet => {
  const { values, warnings } = parseAmountFields(reportList, AMOUNT_FIELD_LABELS);
  return { ...values, warnings };
};
