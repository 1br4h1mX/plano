export default function Logo({ size = 'md', showWord = true, className = '' }) {
  const box = size === 'lg' ? 'h-10 w-10 rounded-2xl' : size === 'sm' ? 'h-6 w-6 rounded-lg' : 'h-8 w-8 rounded-xl';
  const word = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className={`${box} bg-brand grid place-items-center shadow-card shrink-0`}>
        <svg viewBox="0 0 24 24" className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 7h12M6 12h9M6 17h7" />
        </svg>
      </span>
      {showWord && <span className={`${word} font-extrabold tracking-tight text-ink`}>Plano</span>}
    </span>
  );
}