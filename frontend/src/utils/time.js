const DAY = 24 * 60 * 60 * 1000;

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clockTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

export function dayLabel(value) {
  const date = toDate(value);
  if (!date) return '';
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const diff = startOfToday.getTime() - new Date(date).setHours(0, 0, 0, 0);
  if (diff <= 0) return 'Today';
  if (diff <= DAY) return 'Yesterday';
  if (diff < 7 * DAY) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export const money = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100);

export const postPrice = (post) => money(post?.starting_price_minor || ((post?.price_reference || 0) * 100), post?.currency || 'INR');
