export default function Toggle({ checked, onChange, label, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-brand' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-card transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}