const STYLES = {
  draft: ['Draft', 'bg-slate-100 text-slate-700 ring-slate-300'],
  checked: ['Checked', 'bg-sky-50 text-sky-800 ring-sky-300'],
  submitted: ['Submitted', 'bg-violet-50 text-violet-800 ring-violet-300'],
  approved: ['Approved', 'bg-emerald-50 text-emerald-800 ring-emerald-300'],
  changes_requested: ['Changes requested', 'bg-amber-50 text-amber-900 ring-amber-300'],
};

export default function StatusPill({ status }) {
  const [label, cls] = STYLES[status] || [status, STYLES.draft[1]];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}
