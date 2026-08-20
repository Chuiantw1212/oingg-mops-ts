export interface MonthlyCpiPoint {
  year: number; // 西元年
  month: number; // 1-12
  indexValue: number; // 消費者物價總指數（原始指數值，非年增率/月增率——換算通膨率是下游計算，不在本服務範圍）
}
