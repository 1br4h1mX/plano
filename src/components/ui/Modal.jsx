import { useEffect } from 'react';
import { Icon } from './Icons.jsx';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${SIZES[size]} bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-pop animate-pop-in max-h-[92vh] flex flex-col`}>
        {(title || onClose) && (
          <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-line">
            <div>
              {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-sub">{description}</p>}
            </div>
            {onClose && (
              <button type="button" onClick={onClose} className="btn-icon -mr-1 -mt-1 shrink-0" aria-label="Close dialog">
                <Icon name="close" className="h-4.5 w-4.5" />
              </button>
            )}
          </header>
        )}
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}