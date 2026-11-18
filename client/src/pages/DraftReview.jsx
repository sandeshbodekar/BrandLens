import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Play, ArrowLeft, ShieldCheck, WifiOff } from 'lucide-react';
import { api } from '../api.js';
import StatusPill from '../components/StatusPill.jsx';
import DisclosureBanner from '../components/DisclosureBanner.jsx';
import HighlightedText from '../components/HighlightedText.jsx';
import FindingCard from '../components/FindingCard.jsx';

// Summary bar text, e.g. "5 findings: 3 high, 1 medium, 1 low. 2 pending."
function summarise(findings) {
  if (findings.length === 0) return 'No findings.';
  const n = (k, v) => findings.filter((f) => f[k] === v).length;
  const word = findings.length === 1 ? 'finding' : 'findings';
  return `${findings.length} ${word}: ${n('severity', 'high')} high, ${n('severity', 'medium')} medium, ${n('severity', 'low')} low. ${n('decision', 'pending')} pending.`;
}

export default function DraftReview() {
  const { id } = useParams();
  const [data, setData] = useState(null); // { draft, text, findings, versions }
  const [me, setMe] = useState(null); // { user, workspace }
  const [sources, setSources] = useState({}); // code -> { title, text }
  const [loadError, setLoadError] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [mode, setMode] = useState(null); // mode from the last review run in this session
  const [selectedId, setSelectedId] = useState(null);
  const cardRefs = useRef({});

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [draftData, meData] = await Promise.all([api.get(`/api/drafts/${id}`), api.get('/api/auth/me')]);
      setData(draftData);
      setMe(meData);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // Source chips show the clause/fact text on hover. Failing here is not fatal.
  useEffect(() => {
    Promise.all([api.get('/api/clauses'), api.get('/api/facts')])
      .then(([clauses, facts]) => {
        const map = {};
        clauses.forEach((c) => (map[c.code] = { title: c.title, text: c.text }));
        facts.forEach((f) => (map[f.code] = { title: '', text: f.statement }));
        setSources(map);
      })
      .catch(() => {});
  }, []);

  async function runReview() {
    setRunning(true);
    setRunError('');
    try {
      const result = await api.post(`/api/drafts/${id}/review`);
      setMode(result.mode);
      setSelectedId(null);
      await load(); // reload so the page shows the saved findings and the new status
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  }

  function select(findingId) {
    setSelectedId(findingId);
    // Highlight click scrolls to the card; card click scrolls to the highlight.
    document.getElementById(`card-${findingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById(`hl-${findingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const findings = data?.findings ?? [];
  const sorted = useMemo(() => [...findings].sort((a, b) => a.start - b.start || a.end - b.end), [findings]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Could not load this draft: {loadError}
        </p>
        <Link to="/drafts" className="mt-3 inline-block text-sm underline">Back to drafts</Link>
      </div>
    );
  }
  if (!data || !me) {
    return (
      <p className="flex items-center gap-2 px-4 py-8 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading draft…
      </p>
    );
  }

  const { draft, text } = data;
  const role = me.user.role;
  const rulesOnlyWorkspace = me.workspace?.aiEnabled === false;
  const canReview = (role === 'creator' || role === 'admin') && ['draft', 'checked'].includes(draft.status);
  // AI was expected (workspace has it on) but the last run fell back to rules only.
  const aiUnavailable = mode === 'rules-only' && !rulesOnlyWorkspace;
  const backTo = role === 'reviewer' ? '/queue' : '/drafts';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} aria-hidden="true" /> Back
      </Link>

      <header className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{draft.title}</h1>
        <StatusPill status={draft.status} />
        <span className="text-sm text-slate-500">Version {draft.currentVersion}</span>
        <div className="ml-auto">
          {canReview && (
            <button
              type="button"
              onClick={runReview}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-teal-900"
            >
              {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {running ? 'Reviewing…' : 'Run review'}
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <DisclosureBanner rulesOnly={rulesOnlyWorkspace} />
        {aiUnavailable && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            AI review was unavailable, so this result uses the rule checks only. Try running the review again.
          </div>
        )}
        {runError && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{runError}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white" aria-live="polite">
        <ShieldCheck size={16} aria-hidden="true" />
        {draft.status === 'draft' && findings.length === 0 ? 'Not reviewed yet. Run review to check this version.' : summarise(findings)}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section aria-label="Draft text" className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Draft text</h2>
          <HighlightedText text={text} findings={sorted} selectedId={selectedId} onSelect={select} />
        </section>

        <section aria-label="Findings">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Findings</h2>
          {running && findings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking against guidelines and facts…
            </p>
          )}
          {!running && sorted.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-700">
              {draft.status === 'draft'
                ? canReview
                  ? 'Run review to see issues, with the rule or fact behind each one.'
                  : 'This draft has not been reviewed yet.'
                : 'No issues found in this version.'}
            </div>
          )}
          <div className="space-y-3">
            {sorted.map((f, i) => (
              <FindingCard
                key={f._id}
                ref={(el) => (cardRefs.current[f._id] = el)}
                finding={f}
                index={i}
                selected={f._id === selectedId}
                onSelect={select}
                sources={sources}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
