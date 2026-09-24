import { getPriority } from '../../lib/eisenhower.js';

export default function PriorityBadge({ value, showLabel = false }) {
  const p = getPriority(value);
  return (
    <span className={`chip ${p.badge} whitespace-nowrap`} title={p.label}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden="true" />
      {showLabel ? p.short : `P${p.value}`}
    </span>
  );
}