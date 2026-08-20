// 爬蟲社群實測：固定週期的請求間隔（例如每次都精確等 5 秒）容易被防火牆/WAF 依「規律性」識別為機器人流量，
// 就算間隔長度本身合理也一樣。因此改用區間內隨機浮動的等待時間，而非固定毫秒數。
// 5~10 秒是社群針對這類非官方/半官方端點普遍建議的區間（2026-08-20 依使用者提供的社群實測經驗調整）。
export const politeDelay = async (minMs = 5000, maxMs = 10000): Promise<void> => {
  const ms = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, ms));
};
