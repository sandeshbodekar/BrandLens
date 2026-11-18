import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api.js';

const MAX = 10000; // SRS 7.3
const TYPES = [
  ['post', 'Post'],
  ['ad', 'Ad'],
  ['email', 'Email'],
  ['document', 'Document'],
];

export default function NewDraft() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('post');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tooLong = text.length > MAX;
  const canSubmit = title.trim() && text.trim() && !tooLong && !busy;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const { draft } = await api.post('/api/drafts', { title: title.trim(), contentType, text });
      navigate(`/drafts/${draft._id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const field = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">New draft</h1>
      <p className="mt-1 text-sm text-slate-600">Paste the content you want checked against the brand guidelines.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor="title" className="text-sm font-medium text-slate-800">Title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className={field} />
          </div>
          <div>
            <label htmlFor="type" className="text-sm font-medium text-slate-800">Content type</label>
            <select id="type" value={contentType} onChange={(e) => setContentType(e.target.value)} className={field}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="text" className="text-sm font-medium text-slate-800">Text</label>
          <textarea id="text" value={text} onChange={(e) => setText(e.target.value)} rows={12} required className={`${field} leading-6`} />
          <p className={`mt-1 text-xs ${tooLong ? 'font-semibold text-red-700' : 'text-slate-500'}`} aria-live="polite">
            {text.length.toLocaleString()} / {MAX.toLocaleString()} characters
            {tooLong && ' - too long, shorten the text'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Create draft
          </button>
          <Link to="/drafts" className="text-sm text-slate-600 underline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
