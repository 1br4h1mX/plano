export default function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex items-center gap-0.5 bg-elevated border border-line rounded-xl p-0.5 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              active ? 'bg-surface shadow-card text-ink' : 'text-sub hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}