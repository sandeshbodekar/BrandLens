import SeverityBadge from './components/SeverityBadge.jsx';

// Describes the three knowledge-base resources (SRS 7.2) so one generic
// <ResourceTab> can render the table, the add/edit form and the delete flow.
// Field names are exactly the SRS 5 / API field names.
//
// Config shape:
//   columns  [{ header, render(item) }]                      table columns
//   fields   [{ name, label, type, ... }]                    form inputs
//            type: text | textarea | lines | select | checkbox | date
//            lines = one value per line (turned into an array on save)
//   emptyForm() / toForm(item) / toPayload(form)             form <-> API conversion

const CATEGORIES = ['tone', 'terminology', 'claims', 'legal', 'visual', 'accessibility'];
const SEVERITIES = ['high', 'medium', 'low'];

const toOptions = (list) =>
  list.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const splitLines = (text) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const dateOnly = (iso) => (iso ? iso.slice(0, 10) : ''); // "2026-10-01T00:00:00.000Z" -> "2026-10-01"
const todayUtc = () => new Date().toISOString().slice(0, 10); // same UTC-day rule as the server

// Mirrors the SRS 7.2 definition of a valid fact.
function factStatus(fact) {
  if (!fact.active) return { label: 'Inactive', style: 'border-slate-300 bg-slate-100 text-slate-700' };
  const today = todayUtc();
  if (dateOnly(fact.validFrom) > today)
    return { label: 'Not yet valid', style: 'border-amber-200 bg-amber-100 text-amber-900' };
  if (fact.validTo && dateOnly(fact.validTo) < today)
    return { label: 'Expired', style: 'border-amber-200 bg-amber-100 text-amber-900' };
  return { label: 'Valid', style: 'border-green-200 bg-green-100 text-green-800' };
}

const Code = ({ children }) => <span className="font-mono text-xs font-semibold">{children}</span>;

const clauses = {
  key: 'clauses',
  title: 'Clauses',
  singular: 'clause',
  plural: 'clauses',
  path: '/api/clauses',
  description: 'Approved brand guideline rules. Every finding must cite one of these.',
  describe: (item) => item.code,
  columns: [
    { header: 'Code', render: (c) => <Code>{c.code}</Code> },
    { header: 'Category', render: (c) => <span className="capitalize">{c.category}</span> },
    {
      header: 'Rule',
      render: (c) => (
        <>
          <div className="font-medium text-slate-900">{c.title}</div>
          <div className="mt-0.5 text-xs text-slate-600">{c.text}</div>
        </>
      ),
    },
    { header: 'Default severity', render: (c) => <SeverityBadge severity={c.severityDefault} /> },
    { header: 'Active', render: (c) => (c.active ? 'Yes' : 'No') },
  ],
  fields: [
    { name: 'code', label: 'Code', type: 'text', required: true, lockedWhenEditing: true, placeholder: 'C-4.2', help: 'Set once; it cannot be changed later.' },
    { name: 'category', label: 'Category', type: 'select', required: true, options: toOptions(CATEGORIES) },
    { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
    { name: 'text', label: 'Rule text', type: 'textarea', required: true, wide: true },
    { name: 'severityDefault', label: 'Default severity', type: 'select', required: true, options: toOptions(SEVERITIES) },
    { name: 'active', label: 'Active (used in reviews)', type: 'checkbox' },
  ],
  emptyForm: () => ({ code: '', category: 'claims', title: '', text: '', severityDefault: 'medium', active: true }),
  toForm: (c) => ({
    code: c.code,
    category: c.category,
    title: c.title,
    text: c.text,
    severityDefault: c.severityDefault,
    active: c.active,
  }),
  toPayload: (f) => ({ ...f }),
};

const facts = {
  key: 'facts',
  title: 'Facts',
  singular: 'fact',
  plural: 'facts',
  path: '/api/facts',
  description: 'Approved facts with validity dates. Only currently valid facts can be cited.',
  describe: (item) => item.code,
  columns: [
    { header: 'Code', render: (f) => <Code>{f.code}</Code> },
    {
      header: 'Statement',
      render: (f) => (
        <>
          <div className="font-medium text-slate-900">{f.statement}</div>
          {f.currentText && <div className="mt-0.5 text-xs text-slate-600">{`Current text: ${f.currentText}`}</div>}
          {f.staleVariants.length > 0 && (
            <div className="mt-0.5 text-xs text-slate-600">{`Stale values: ${f.staleVariants.join(', ')}`}</div>
          )}
        </>
      ),
    },
    {
      header: 'Valid',
      render: (f) => `${dateOnly(f.validFrom)} to ${f.validTo ? dateOnly(f.validTo) : 'no end date'}`,
    },
    {
      header: 'Status',
      render: (f) => {
        const s = factStatus(f);
        return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${s.style}`}>{s.label}</span>;
      },
    },
  ],
  fields: [
    { name: 'code', label: 'Code', type: 'text', required: true, lockedWhenEditing: true, placeholder: 'F-20', help: 'Set once; it cannot be changed later.' },
    { name: 'currentText', label: 'Current text (optional)', type: 'text', placeholder: 'Rs 109', help: 'Exact wording to suggest when a stale value is found.' },
    { name: 'statement', label: 'Statement', type: 'textarea', required: true, wide: true },
    { name: 'staleVariants', label: 'Stale values (optional)', type: 'lines', wide: true, help: 'Outdated wordings to flag. One per line.' },
    { name: 'validFrom', label: 'Valid from', type: 'date', required: true },
    { name: 'validTo', label: 'Valid to (optional)', type: 'date', help: 'Leave blank for no end date.' },
    { name: 'active', label: 'Active', type: 'checkbox' },
  ],
  emptyForm: () => ({ code: '', currentText: '', statement: '', staleVariants: '', validFrom: todayUtc(), validTo: '', active: true }),
  toForm: (f) => ({
    code: f.code,
    currentText: f.currentText || '',
    statement: f.statement,
    staleVariants: f.staleVariants.join('\n'),
    validFrom: dateOnly(f.validFrom),
    validTo: dateOnly(f.validTo),
    active: f.active,
  }),
  toPayload: (f) => ({
    code: f.code,
    currentText: f.currentText,
    statement: f.statement,
    staleVariants: splitLines(f.staleVariants),
    validFrom: f.validFrom,
    validTo: f.validTo || null,
    active: f.active,
  }),
};

const terms = {
  key: 'terms',
  title: 'Terms',
  singular: 'term',
  plural: 'terms',
  path: '/api/terms',
  description: 'Preferred wording and the words that must not be used.',
  describe: (item) => item.preferred,
  columns: [
    { header: 'Preferred', render: (t) => <span className="font-medium text-slate-900">{t.preferred}</span> },
    { header: 'Banned', render: (t) => t.banned.join(', ') },
    { header: 'Cites clause', render: (t) => <Code>{t.clauseCode}</Code> },
    { header: 'Note', render: (t) => t.note || '' },
  ],
  fields: [
    { name: 'preferred', label: 'Preferred term', type: 'text', required: true },
    {
      name: 'clauseCode',
      label: 'Cited clause',
      type: 'select',
      required: true,
      placeholder: 'Select a clause',
      options: (ctx) => ctx.clauses.map((c) => ({ value: c.code, label: `${c.code}: ${c.title}` })),
    },
    { name: 'banned', label: 'Banned terms', type: 'lines', required: true, wide: true, help: 'Matched case-insensitively as whole words. One per line.' },
    { name: 'note', label: 'Note (optional)', type: 'text', wide: true },
  ],
  emptyForm: () => ({ preferred: '', clauseCode: '', banned: '', note: '' }),
  toForm: (t) => ({ preferred: t.preferred, clauseCode: t.clauseCode, banned: t.banned.join('\n'), note: t.note || '' }),
  toPayload: (f) => ({ preferred: f.preferred, clauseCode: f.clauseCode, banned: splitLines(f.banned), note: f.note }),
};

// Order here is the order of the tabs.
export const RESOURCES = { clauses, facts, terms };
