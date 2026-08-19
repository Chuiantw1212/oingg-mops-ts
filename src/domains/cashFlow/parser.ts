import { type MopsReportRow, type FieldSpec, parseAmountFields } from '../../shared/mopsReportParsing.js';

export type { MopsReportRow };

const AMOUNT_FIELD_KEYS = [
  // 營業活動
  'profitBeforeTax',
  'depreciation',
  'amortization',
  'adjustmentsTotal',
  'cashGeneratedFromOperations',
  'incomeTaxPaid',
  'netCashFromOperatingActivities',
  // 投資活動
  'capitalExpenditures',
  'proceedsFromDisposalOfPpe',
  'acquisitionOfIntangibleAssets',
  'interestReceived',
  'dividendsReceived',
  'netCashFromInvestingActivities',
  // 籌資活動
  'proceedsFromBondsIssued',
  'repaymentOfBonds',
  'proceedsFromLongTermBorrowings',
  'repaymentOfLongTermBorrowings',
  'dividendsPaid',
  'interestPaid',
  'netCashFromFinancingActivities',
  // 匯率影響與現金餘額
  'exchangeRateEffect',
  'netIncreaseInCash',
  'cashBeginningBalance',
  'cashEndingBalance',
  'cashPerBalanceSheet',
] as const;
type AmountFieldKey = (typeof AMOUNT_FIELD_KEYS)[number];

export type ParsedCashFlow = {
  [K in AmountFieldKey]: bigint | null;
} & {
  warnings: string[];
};

// key -> (可能出現的科目名稱，依優先序；MOPS 不同季度/公司偶爾用字略有差異)
const AMOUNT_FIELD_LABELS: Record<AmountFieldKey, FieldSpec> = {
  profitBeforeTax: { labels: ['本期稅前淨利（淨損）', '繼續營業單位稅前淨利（淨損）'], required: true },
  depreciation: { labels: ['折舊費用'] },
  amortization: { labels: ['攤銷費用'] },
  adjustmentsTotal: { labels: ['調整項目合計'] },
  cashGeneratedFromOperations: { labels: ['營運產生之現金流入（流出）'] },
  incomeTaxPaid: { labels: ['退還（支付）之所得稅'] },
  netCashFromOperatingActivities: { labels: ['營業活動之淨現金流入（流出）'], required: true },

  capitalExpenditures: { labels: ['取得不動產、廠房及設備', '取得不動產及設備'] }, // 金融業科目無「廠房」二字
  proceedsFromDisposalOfPpe: { labels: ['處分不動產、廠房及設備', '處分不動產及設備'] },
  acquisitionOfIntangibleAssets: { labels: ['取得無形資產'] },
  interestReceived: { labels: ['收取之利息'] },
  dividendsReceived: { labels: ['收取之股利'] },
  netCashFromInvestingActivities: { labels: ['投資活動之淨現金流入（流出）'], required: true },

  proceedsFromBondsIssued: { labels: ['發行公司債'] },
  repaymentOfBonds: { labels: ['償還公司債'] },
  proceedsFromLongTermBorrowings: { labels: ['舉借長期借款'] },
  repaymentOfLongTermBorrowings: { labels: ['償還長期借款'] },
  dividendsPaid: { labels: ['發放現金股利'] },
  interestPaid: { labels: ['支付之利息'] },
  netCashFromFinancingActivities: { labels: ['籌資活動之淨現金流入（流出）'], required: true },

  exchangeRateEffect: { labels: ['匯率變動對現金及約當現金之影響'] },
  netIncreaseInCash: { labels: ['本期現金及約當現金增加（減少）數'] },
  cashBeginningBalance: { labels: ['期初現金及約當現金餘額'] },
  cashEndingBalance: { labels: ['期末現金及約當現金餘額'], required: true },
  // 金融業的「期末現金及約當現金餘額」（cashEndingBalance）依 IAS 7 定義涵蓋存放央行、附賣回票券等項目，
  // 範圍比資產負債表上的「現金及約當現金」寬，兩者不會相等。這行才是對應資產負債表口徑的數字，
  // 三表勾稽（reconciliation）應該用這欄位去對資產負債表，而不是 cashEndingBalance。
  cashPerBalanceSheet: { labels: ['資產負債表帳列之現金及約當現金'] },
};

// 注意：MOPS 現金流量表回傳的是「累計」數（例如 Q2 = 當年 1/1 ~ 6/30 累計），
// 不是單季數字；row[1] 即為本期累計金額，本函式如實存下該累計值。
export const parseCashFlowReport = (reportList: MopsReportRow[]): ParsedCashFlow => {
  const { values, warnings } = parseAmountFields(reportList, AMOUNT_FIELD_LABELS);
  return { ...values, warnings };
};
