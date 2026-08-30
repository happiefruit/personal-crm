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

/** Compact USD: "$0" / "$0.0018" for tiny amounts / "$1.24" otherwise. */
export function formatUsd(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0';
  if (v < 0.1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

/** "12,345" */
export function formatInt(n) {
  return (Number(n) || 0).toLocaleString();
}

/** Human due-date label: "today", "in 3 days", "2 days overdue", "in 5 weeks". */
export function formatDue(iso) {
  if (!iso) return '';
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays < 0) {
    const d = -diffDays;
    return d < 14 ? `${d} days overdue` : `${Math.round(d / 7)} weeks overdue`;
  }
  if (diffDays < 14) return `in ${diffDays} days`;
  if (diffDays < 60) return `in ${Math.round(diffDays / 7)} weeks`;
  return `in ${Math.round(diffDays / 30)} months`;
}

/** Age in whole years from a YYYY-MM-DD birthdate; null if year unknown or unparseable. */
export function computeAge(birthdate) {
  if (!birthdate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m || m[1] === '0000') return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const now = new Date();
  let age = now.getFullYear() - y;
  const hadBirthday =
    now.getMonth() + 1 > mo || (now.getMonth() + 1 === mo && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}
