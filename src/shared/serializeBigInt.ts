// BigInt 欄位無法被 JSON.stringify 直接序列化，轉成 string。
export const serializeBigInt = <T>(value: T) =>
  JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
