export type TopicSortDirection = 'asc' | 'desc';

const normalizeTopicCode = (value?: string | null): number[] | null => {
  if (!value) return null;
  const cleaned = String(value).trim().replace(',', '.');
  if (!cleaned) return null;

  const parts = cleaned
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isFinite(num))) return null;
  return nums;
};

const compareTopicCodeAsc = (left?: string | null, right?: string | null): number => {
  const l = normalizeTopicCode(left);
  const r = normalizeTopicCode(right);

  if (!l && !r) return String(left ?? '').localeCompare(String(right ?? ''), 'uk');
  if (!l) return 1;
  if (!r) return -1;

  const maxLen = Math.max(l.length, r.length);
  for (let i = 0; i < maxLen; i += 1) {
    const li = l[i] ?? 0;
    const ri = r[i] ?? 0;
    if (li !== ri) return li - ri;
  }

  if (l.length !== r.length) return l.length - r.length;
  return 0;
};

export const compareHistoryTopicCodes = (
  left?: string | null,
  right?: string | null,
  direction: TopicSortDirection = 'asc',
): number => {
  const result = compareTopicCodeAsc(left, right);
  return direction === 'desc' ? -result : result;
};
