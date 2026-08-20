import { type MopsReportRow, type FieldSpec, parseAmountFields } from '../../shared/mopsReportParsing';

export type { MopsReportRow };

const AMOUNT_FIELD_KEYS = [
  // 資產（一般業）
  'cashAndEquivalents',
  'accountsReceivable',
  'inventory',
  'currentAssets',
  'propertyPlantEquipment',
  'investmentsUnderEquityMethod',
  'intangibleAssets',
  'nonCurrentAssets',
  'totalAssets',
  // 資產（金控/銀行/保險業特有；一般業結構性沒有這些科目）
  'depositsWithCentralBankAndBanks',
  'financialAssetsAtFvtpl',
  'financialAssetsAtFvoci',
  'debtInstrumentsAtAmortizedCost',
  'securitiesPurchasedUnderResellAgreements',
  'currentTaxAssets',
  'assetsHeldForSale',
  'loansNet',
  'insuranceContractAssets',
  'otherFinancialAssets',
  'investmentProperty',
  'rightOfUseAssets',
  'deferredTaxAssets',
  'otherAssets',
  // 負債（一般業）
  'shortTermBorrowings',
  'accountsPayable',
  'currentLiabilities',
  'bondsPayable',
  'longTermBorrowings',
  'nonCurrentLiabilities',
  'totalLiabilities',
  // 負債（金控/銀行/保險業特有）
  'depositsFromCentralBankAndBanks',
  'financialLiabilitiesAtFvtpl',
  'securitiesSoldUnderRepurchaseAgreements',
  'commercialPaperPayable',
  'currentTaxLiabilities',
  'depositsAndRemittances',
  'otherBorrowings',
  'preferredStockLiability',
  'provisions',
  'otherFinancialLiabilities',
  'insuranceContractLiabilities',
  'leaseLiabilities',
  'deferredTaxLiabilities',
  'otherLiabilities',
  // 權益
  'capitalStock',
  'commonStockCapital',
  'preferredStockCapital',
  'capitalSurplus',
  'legalReserve',
  'specialReserve',
  'undistributedEarnings',
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

  // 以下十四個科目結構性只存在於金控/銀行/保險業（一般業的資產負債表沒有這些概念），故都不算 required。
  // 2026-08-20 依台新新光金（2887）合併資產負債表真實回應逐項核對補上，之前的版本完全沒有涵蓋這些科目。
  depositsWithCentralBankAndBanks: { labels: ['存放央行及拆借金融同業'] },
  financialAssetsAtFvtpl: { labels: ['透過損益按公允價值衡量之金融資產'] },
  financialAssetsAtFvoci: { labels: ['透過其他綜合損益按公允價值衡量之金融資產'] },
  debtInstrumentsAtAmortizedCost: { labels: ['按攤銷後成本衡量之債務工具投資'] },
  securitiesPurchasedUnderResellAgreements: { labels: ['附賣回票券及債券投資'] },
  currentTaxAssets: { labels: ['本期所得稅資產'] },
  assetsHeldForSale: { labels: ['待出售資產－淨額', '待出售資產'] },
  loansNet: { labels: ['貼現及放款－淨額', '貼現及放款'] }, // 銀行核心資產科目，佔資產負債表相當高比重，之前完全沒有欄位對應
  insuranceContractAssets: { labels: ['保險合約資產及再保險合約資產－淨額', '保險合約資產及再保險合約資產'] },
  otherFinancialAssets: { labels: ['其他金融資產－淨額', '其他金融資產'] },
  investmentProperty: { labels: ['投資性不動產－淨額', '投資性不動產'] },
  rightOfUseAssets: { labels: ['使用權資產－淨額', '使用權資產'] },
  deferredTaxAssets: { labels: ['遞延所得稅資產'] },
  otherAssets: { labels: ['其他資產－淨額', '其他資產'] },

  shortTermBorrowings: { labels: ['短期借款'] },
  accountsPayable: { labels: ['應付帳款', '應付款項'] },
  currentLiabilities: { labels: ['流動負債合計'] },
  // 部分金控同時有「公司債」與「金融債券」兩種獨立科目（例如富邦金），非互斥別名，故加總。
  bondsPayable: { labels: ['應付公司債', '應付債券', '應付金融債券'], sumAllMatches: true },
  longTermBorrowings: { labels: ['長期借款'] },
  nonCurrentLiabilities: { labels: ['非流動負債合計'] },
  totalLiabilities: { labels: ['負債總額', '負債總計'], required: true },

  // 以下十四個科目同樣結構性只存在於金控/銀行/保險業。
  depositsFromCentralBankAndBanks: { labels: ['央行及金融同業存款'] },
  financialLiabilitiesAtFvtpl: { labels: ['透過損益按公允價值衡量之金融負債'] },
  securitiesSoldUnderRepurchaseAgreements: { labels: ['附買回票券及債券負債'] },
  commercialPaperPayable: { labels: ['應付商業本票－淨額', '應付商業本票'] },
  currentTaxLiabilities: { labels: ['本期所得稅負債'] },
  depositsAndRemittances: { labels: ['存款及匯款'] }, // 銀行核心負債科目（存款），佔資產負債表相當高比重，之前完全沒有欄位對應
  otherBorrowings: { labels: ['其他借款'] },
  // 特別股負債：部分特別股條款依 IFRS 分類為負債而非權益，跟 preferredStockCapital（權益項下的特別股股本）是不同概念，兩者互不相關、不要混用。
  preferredStockLiability: { labels: ['特別股負債'] },
  provisions: { labels: ['負債準備'] },
  otherFinancialLiabilities: { labels: ['其他金融負債'] },
  insuranceContractLiabilities: { labels: ['保險合約負債及再保險合約負債'] },
  leaseLiabilities: { labels: ['租賃負債'] },
  deferredTaxLiabilities: { labels: ['遞延所得稅負債'] },
  otherLiabilities: { labels: ['其他負債'] },

  capitalStock: { labels: ['股本合計', '股本'] },
  // 普通股股本/特別股股本是股本的子項（股本 = 普通股股本 + 特別股股本）。不是所有公司都有特別股，結構性缺欄不算 required。
  commonStockCapital: { labels: ['普通股股本'] },
  preferredStockCapital: { labels: ['特別股股本'] },
  capitalSurplus: { labels: ['資本公積合計', '資本公積'] },
  // 法定盈餘公積/特別盈餘公積/未分配盈餘是保留盈餘的子項，其中未分配盈餘（或待彌補虧損）是判斷配息能力最直接的數字。
  legalReserve: { labels: ['法定盈餘公積'] },
  specialReserve: { labels: ['特別盈餘公積'] },
  undistributedEarnings: { labels: ['未分配盈餘（或待彌補虧損）', '未分配盈餘（或累積虧損）', '未分配盈餘'] },
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
