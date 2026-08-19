export type Season = '1' | '2' | '3' | '4';

// 公開發行公司季報法定公告截止日：Q1 5/15、Q2 8/14、Q3 11/14、Q4(年報) 次年 3/31。
// monthOffsetYears: 截止日落在「該季度所屬 ROC 年 + 1911」的隔幾個西元年（Q4 跨到隔年）。
const QUARTER_DEADLINES: Record<Season, { monthOffsetYears: number; month: number; day: number }> = {
  '1': { monthOffsetYears: 0, month: 5, day: 15 },
  '2': { monthOffsetYears: 0, month: 8, day: 14 },
  '3': { monthOffsetYears: 0, month: 11, day: 14 },
  '4': { monthOffsetYears: 1, month: 3, day: 31 },
};

const SEASONS_DESC: Season[] = ['4', '3', '2', '1'];

// 依法定截止日，找出「今天」為止最新一筆應該已經公告的季度。
export const getLatestAvailableQuarter = (today: Date): { rocYear: number; season: Season } => {
  const currentRocYear = today.getFullYear() - 1911;

  // 由近至遠依序檢查：今年 Q4~Q1，再往前一年 Q4~Q1。最壞情況（例如今天是 1 月初，
  // 去年 Q4 的截止日 3/31 都還沒到）需要一路查到前年 Q3，因此涵蓋今年 + 前一年共 8 季足夠。
  const candidates: { rocYear: number; season: Season }[] = [
    ...SEASONS_DESC.map((season) => ({ rocYear: currentRocYear, season })),
    ...SEASONS_DESC.map((season) => ({ rocYear: currentRocYear - 1, season })),
  ];

  for (const candidate of candidates) {
    const { monthOffsetYears, month, day } = QUARTER_DEADLINES[candidate.season];
    const deadline = new Date(candidate.rocYear + 1911 + monthOffsetYears, month - 1, day);
    if (today.getTime() >= deadline.getTime()) {
      return candidate;
    }
  }

  // 理論上不會到這裡（8 季已涵蓋最壞情況）；保底回傳前年 Q4。
  return { rocYear: currentRocYear - 2, season: '4' };
};

// 由 latest 往前數 n 季（含 latest 本身），依時間先後（舊 -> 新）回傳。
export const getPastNQuarters = (latest: { rocYear: number; season: Season }, n: number): { year: string; season: Season }[] => {
  const quarters: { rocYear: number; season: Season }[] = [];
  let { rocYear, season } = latest;
  for (let i = 0; i < n; i++) {
    quarters.push({ rocYear, season });
    const idx = SEASONS_DESC.indexOf(season);
    if (idx === SEASONS_DESC.length - 1) {
      rocYear -= 1;
      season = '4';
    } else {
      season = SEASONS_DESC[idx + 1]!;
    }
  }
  return quarters.reverse().map((q) => ({ year: String(q.rocYear), season: q.season }));
};

// 季度結束日（西元）。用於財報的 reportDate 欄位；MOPS 原始資料本身沒有明確的日期欄位。
export const getQuarterEndDate = (rocYear: string, season: Season): Date => {
  const gregorianYear = Number(rocYear) + 1911;
  const quarterEndMonthDay: Record<Season, [number, number]> = {
    '1': [2, 31], // 3/31 (month is 0-indexed)
    '2': [5, 30], // 6/30
    '3': [8, 30], // 9/30
    '4': [11, 31], // 12/31
  };
  const [month, day] = quarterEndMonthDay[season];
  return new Date(Date.UTC(gregorianYear, month, day));
};
