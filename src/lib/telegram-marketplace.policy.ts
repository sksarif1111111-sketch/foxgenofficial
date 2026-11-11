export const quantityChoices = (stock: number, min = 1) => [...new Set([1, 2, 3, 5, stock])].filter(n => Number.isInteger(n) && n >= min && n <= stock);
export function orderTime(confirmed: string | null, delivered: string | null, minutes: number, now = Date.now()) {
  if (!confirmed) return null;
  const start = Date.parse(confirmed);
  if (!Number.isFinite(start)) return null;
  if (delivered) return `Delivered in ${Math.max(0, Math.ceil((Date.parse(delivered) - start) / 60000))} min`;
  const seconds = Math.ceil((start + minutes * 60000 - now) / 1000);
  return seconds <= 0 ? 'Delayed — support is following up' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`;
}