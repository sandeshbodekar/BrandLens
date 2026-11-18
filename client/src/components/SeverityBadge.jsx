import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';

// Colour is never the only signal: every badge has an icon and a text label.
export const SEVERITY = {
  high: { label: 'High', Icon: AlertOctagon, badge: 'bg-red-50 text-red-800 ring-red-300', mark: 'bg-red-100 decoration-red-600' },
  medium: { label: 'Medium', Icon: AlertTriangle, badge: 'bg-amber-50 text-amber-900 ring-amber-300', mark: 'bg-amber-100 decoration-amber-600' },
  low: { label: 'Low', Icon: Info, badge: 'bg-slate-100 text-slate-700 ring-slate-300', mark: 'bg-slate-200 decoration-slate-500' },
};

export default function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.low;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.badge}`}>
      <s.Icon size={12} aria-hidden="true" />
      {s.label}
    </span>
  );
}
