export function formatDate(iso) {
  if (!iso) return '';
  // Year-less dates (e.g. a birthday) are stored as 0000-MM-DD.
  const m = /^0000-(\d{2})-(\d{2})$/.exec(iso);
  if (m) {
    const d = new Date(2000, Number(m[1]) - 1, Number(m[2]));
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day) return 'today';
  const days = Math.floor(diff / day);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

export function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}
