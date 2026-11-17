const STYLES = {
  high: 'border-red-200 bg-red-100 text-red-800',
  medium: 'border-amber-200 bg-amber-100 text-amber-900',
  low: 'border-slate-300 bg-slate-100 text-slate-700',
};

// The word is always shown, so colour is never the only signal.
export default function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        STYLES[severity] || STYLES.low
      }`}
    >
      {severity}
    </span>
  );
}
