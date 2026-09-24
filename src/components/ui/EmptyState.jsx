import { Icon } from './Icons.jsx';

export default function EmptyState({ icon = 'inbox', title, blurb, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in">
      <div className="h-14 w-14 rounded-2xl bg-brand/10 text-brand grid place-items-center mb-4">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {blurb && <p className="mt-1.5 max-w-sm text-sm text-sub">{blurb}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}