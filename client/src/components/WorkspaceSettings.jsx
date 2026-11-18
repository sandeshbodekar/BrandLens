import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Admin-only panel at the top of the Knowledge page (SRS 12 phase 7, demo script step 8):
//   - AI mode switch  -> PATCH /api/workspace {aiEnabled}
//   - Reset demo data -> POST /api/demo/reset (asks to confirm first)
// `onReset` lets the page reload its lists, because a reset replaces the knowledge base.
export default function WorkspaceSettings({ onReset }) {
  const { workspace, setWorkspace } = useAuth();
  const aiOn = workspace?.aiEnabled !== false;
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = saving || resetting;

  async function toggleAi() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await api.patch('/api/workspace', { aiEnabled: !aiOn });
      setWorkspace(updated);
      setNotice(updated.aiEnabled ? 'AI review is on.' : 'Rules-only mode is on. Reviews now use the rule checks only.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetDemo() {
    setResetting(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/demo/reset');
      const me = await api.get('/api/auth/me'); // a reset also switches AI mode back to its default
      setWorkspace(me.workspace);
      setConfirming(false);
      if (onReset) onReset();
      setNotice('Demo data was reset: knowledge base and sample drafts are back to the start.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  const btn =
    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="Workspace settings" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Workspace settings</h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* A switch with a text label: the state is never shown by colour alone. */}
        <button
          type="button"
          role="switch"
          aria-checked={aiOn}
          aria-labelledby="ai-switch-label"
          onClick={toggleAi}
          disabled={busy}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${aiOn ? 'bg-teal-700' : 'bg-slate-400'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${aiOn ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
        <span id="ai-switch-label" className="text-sm text-slate-800">
          AI-assisted review: <strong>{aiOn ? 'On' : 'Off (rules-only mode)'}</strong>
        </span>
        {saving && <Loader2 size={16} className="animate-spin text-slate-500" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Off means draft text is never sent to the external AI service. Reviews still work, using the rule checks only.
      </p>

      <div className="mt-4 border-t border-slate-200 pt-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
          >
            <RotateCcw size={16} aria-hidden="true" /> Reset demo data
          </button>
        ) : (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950">
            <p>This deletes every draft, comment and review, and restores the original knowledge base. It cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={resetDemo} disabled={resetting} className={`${btn} bg-red-700 text-white hover:bg-red-600`}>
                {resetting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                Yes, reset everything
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={resetting} className={`${btn} text-slate-800 underline`}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {notice && <p role="status" className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
    </section>
  );
}
