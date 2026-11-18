import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareWarning } from 'lucide-react';
import { api } from '../api.js';

// Reviewer/admin controls on a submitted draft (SRS 7.6, 9). A note is optional for
// "Approve" and required for "Request changes" (the server enforces it too).
export default function ReviewDecisionPanel({ draftId, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null); // null | 'approved' | 'changes_requested'
  const [error, setError] = useState('');

  async function send(decision) {
    if (decision === 'changes_requested' && !note.trim()) {
      setError('Write a note that tells the creator what to change.');
      return;
    }
    setBusy(decision);
    setError('');
    try {
      await api.post(`/api/drafts/${draftId}/decision`, { decision, note: note.trim() });
      await onDone(decision); // the draft status changes, so the parent reloads and hides this panel
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  const btn =
    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900';

  return (
    <section aria-label="Your decision" className="rounded-lg border border-violet-300 bg-violet-50 p-4">
      <h2 className="text-sm font-semibold text-violet-950">Your decision</h2>
      <label htmlFor="decision-note" className="mt-3 block text-sm text-violet-950">
        Note for the creator (required to request changes)
      </label>
      <textarea
        id="decision-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        disabled={busy !== null}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
      />
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => send('approved')} disabled={busy !== null} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}>
          {busy === 'approved' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          Approve
        </button>
        <button type="button" onClick={() => send('changes_requested')} disabled={busy !== null} className={`${btn} border border-amber-400 bg-white text-amber-950 hover:bg-amber-50`}>
          {busy === 'changes_requested' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <MessageSquareWarning size={16} aria-hidden="true" />}
          Request changes
        </button>
      </div>
    </section>
  );
}
