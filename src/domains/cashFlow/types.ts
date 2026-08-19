export interface CashFlowPayload {
  companyId: string;
  dataType: '1' | '2'; // 1 for 個體, 2 for 合併
  season: '1' | '2' | '3' | '4';
  year: string;
  subsidiaryCompanyId?: string;
}
