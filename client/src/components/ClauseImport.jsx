import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '../api.js';

// Paste-import of guidelines (SRS 7.2 and 9). Two steps, so nothing is saved by accident:
//   1. paste text  -> POST /api/clauses/import  -> preview rows (nothing saved yet)
//   2. review/edit -> POST /api/clauses/bulk    -> saved
// Admin only (the parent only renders it for admins; the server checks too).

const CATEGORIES = ['tone', 'terminology', 'claims', 'legal', 'visual', 'accessibility'];
const SEVERITIES = ['high', 'medium', 'low'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const field =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const btn =
  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

// Same limits as the server (zod). The server checks again on save.
function problemFor(row, index, rows, existingCodes) {
  const code = row.code.trim();
  const lower = code.toLowerCase();
  if (!code) return 'Code is required';
  if (code.length > 30) return 'Code is longer than 30 characters';
  if (!row.title.trim()) return 'Title is required';
  if (row.title.length > 200) return 'Title is longer than 200 characters';
  if (!row.text.trim()) return 'Rule text is required';
  if (row.text.length > 2000) return 'Rule text is longer than 2000 characters';
  if (existingCodes.has(lower)) return 'A clause with this code already exists';
  const earlier = rows.findIndex((r, i) => i < index && r.include && r.code.trim().toLowerCase() === lower);
  if (earlier !== -1) return 'This code is used by an earlier row';
  return null;
}

export default function ClauseImport({ clauses, onSaved }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [rows, setRows] = useState(null); // null = still on the paste step
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false); // previewing or saving
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const existingCodes = new Set(clauses.map((c) => c.code.toLowerCase()));

  function close() {
    setOpen(false);
    setText('');
    setRows(null);
    setSkipped(0);
    setError('');
  }

  const describe = (err) => (err.details?.length ? err.details.map((d) => `${d.path}: ${d.message}`).join('; ') : err.message);

  async function preview() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/api/clauses/import', { text });
      setRows(res.clauses.map((c) => ({ ...c, include: true })));
      setSkipped(res.skipped);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const chosen = rows.filter((r) => r.include);
      const payload = chosen.map(({ code, category, title, text: body, severityDefault }) => ({
        code: code.trim(),
        category,
        title: title.trim(),
        text: body.trim(),
        severityDefault,
        active: true,
      }));
      await api.post('/api/clauses/bulk', { clauses: payload });
      await onSaved();
      close();
      setNotice(`Imported ${chosen.length} ${chosen.length === 1 ? 'clause' : 'clauses'}.`);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const update = (index, patch) => setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  if (!open) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setNotice('');
          }}
          className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Import guidelines from text
        </button>
        {notice && (
          <p role="status" className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            {notice}
          </p>
        )}
      </div>
    );
  }

  const problems = rows ? rows.map((r, i) => (r.include ? problemFor(r, i, rows, existingCodes) : null)) : [];
  const chosenCount = rows ? rows.filter((r) => r.include).length : 0;
  const canSave = rows && chosenCount > 0 && problems.every((p) => p === null) && !busy;

  return (
    <section aria-label="Import guidelines" className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Import guidelines from text</h3>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {rows === null ? (
        <>
          <p className="mt-1 text-sm text-slate-700">
            Paste your guidelines. Separate each rule with a blank line. A leading code such as <code>C-4.2</code>, <code>1.2</code> or{' '}
            <code>1)</code> becomes the clause code (otherwise <code>C-AUTO-1</code>, <code>C-AUTO-2</code>…), and the first sentence becomes the title.
            You review everything before it is saved.
          </p>
          <label htmlFor="import-text" className="mt-3 block text-sm font-medium text-slate-800">Guideline text</label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            maxLength={20000}
            disabled={busy}
            className={`${field} px-3 py-2`}
          />
          <p className="mt-1 text-xs text-slate-600">{text.length.toLocaleString()} / 20,000 characters</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={preview} disabled={busy || text.trim().length === 0} className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Preview clauses
            </button>
            <button type="button" onClick={close} disabled={busy} className={`${btn} text-slate-800 underline`}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-700" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'clause' : 'clauses'} found{skipped ? `, ${skipped} empty ${skipped === 1 ? 'block' : 'blocks'} skipped` : ''}.
            Category and severity are suggestions: please check them. Untick a row to leave it out.
          </p>

          <ol className="mt-3 space-y-3">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-lg border p-3 ${problems[i] ? 'border-red-300 bg-red-50' : 'border-slate-200'} ${r.include ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="h-4 w-4" />
                    Import row {i + 1}
                  </label>
                  {problems[i] && <span role="alert" className="text-sm font-medium text-red-800">{problems[i]}</span>}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-4">
                  <div>
                    <label htmlFor={`imp-code-${i}`} className="block text-xs font-medium text-slate-700">Code</label>
                    <input id={`imp-code-${i}`} value={r.code} onChange={(e) => update(i, { code: e.target.value })} className={`${field} font-mono`} />
                  </div>
                  <div>
                    <label htmlFor={`imp-cat-${i}`} className="block text-xs font-medium text-slate-700">Category</label>
                    <select id={`imp-cat-${i}`} value={r.category} onChange={(e) => update(i, { category: e.target.value })} className={field}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`imp-sev-${i}`} className="block text-xs font-medium text-slate-700">Default severity</label>
                    <select id={`imp-sev-${i}`} value={r.severityDefault} onChange={(e) => update(i, { severityDefault: e.target.value })} className={field}>
                      {SEVERITIES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={`imp-title-${i}`} className="block text-xs font-medium text-slate-700">Title</label>
                    <input id={`imp-title-${i}`} value={r.title} onChange={(e) => update(i, { title: e.target.value })} className={field} />
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={`imp-text-${i}`} className="block text-xs font-medium text-slate-700">Rule text</label>
                    <textarea id={`imp-text-${i}`} rows={3} value={r.text} onChange={(e) => update(i, { text: e.target.value })} className={field} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!canSave} className={`${btn} bg-slate-900 text-white hover:bg-slate-800`}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? 'Saving…' : `Save ${chosenCount} ${chosenCount === 1 ? 'clause' : 'clauses'}`}
            </button>
            <button type="button" onClick={() => { setRows(null); setError(''); }} disabled={busy} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
              Back to text
            </button>
            <button type="button" onClick={close} disabled={busy} className={`${btn} text-slate-800 underline`}>Cancel</button>
          </div>
        </>
      )}
    </section>
  );
}
