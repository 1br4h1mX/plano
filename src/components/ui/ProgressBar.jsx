export default function ProgressBar({ value = 0, className = '', barClassName = 'bg-brand', size = 'md', styleColor }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full bg-line/70 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2.5'} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${barClassName}`}
        style={{ width: `${clamped}%`, ...(styleColor ? { backgroundColor: styleColor } : {}) }}
      />
    </div>
  );
}