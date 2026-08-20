import type { MonthlyCpiPoint } from './types';

// SDMX-JSON 標準結構（已用真實回應核對過，2026-08-20）：
// - data.dataSets[0].series["0"].observations["N"] = [數值]，N 是字串索引，從 "0" 開始。
// - data.structure.dimensions.observation[0].values 是「依序」對應每個觀察值索引的時間點清單
//   （values[N].id 例如 "2026-M7"），跟 observations 的索引 N 一一對應，順序保證一致（已用真實資料核對頭尾）。
// - 因為 series key 已經在請求時鎖定成「1...M.」（總指數、月頻率），series 底下只會有唯一一個鍵 "0"。
interface SdmxJsonResponse {
  data?: {
    dataSets?: { series?: Record<string, { observations?: Record<string, unknown> }> }[];
    structure?: {
      dimensions?: {
        observation?: { values?: { id: string; name: string }[] }[];
      };
    };
  };
}

export const parseMonthlyCpi = (raw: unknown): MonthlyCpiPoint[] => {
  const response = raw as SdmxJsonResponse;
  const observations = response?.data?.dataSets?.[0]?.series?.['0']?.observations;
  const timeValues = response?.data?.structure?.dimensions?.observation?.[0]?.values;

  if (!observations || !timeValues) {
    throw new Error('DGBAS SDMX 回應格式不符預期（缺少 data.dataSets[0].series["0"].observations 或 data.structure.dimensions.observation[0].values），格式可能已變更。');
  }

  const points: MonthlyCpiPoint[] = [];
  for (const [indexStr, obs] of Object.entries(observations)) {
    const index = Number(indexStr);
    const timeInfo = timeValues[index];
    if (!timeInfo) continue; // 理論上不會發生，observation 索引應與時間維度一一對應

    const match = timeInfo.id.match(/^(\d{4})-M(\d{1,2})$/);
    if (!match) continue; // 格式不符預期的時間點，跳過而不是猜

    const value = Array.isArray(obs) ? obs[0] : undefined;
    if (typeof value !== 'number') continue;

    points.push({ year: Number(match[1]), month: Number(match[2]), indexValue: value });
  }

  return points;
};
