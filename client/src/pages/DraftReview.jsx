import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Play, ArrowLeft, Wand2, PencilLine, History, Eye, Send, MessageSquare, MessageSquareWarning, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../api.js';
import StatusPill from '../components/StatusPill.jsx';
import ReviewStatusPanel from '../components/ReviewStatusPanel.jsx';
import HighlightedText from '../components/HighlightedText.jsx';
import FindingCard from '../components/FindingCard.jsx';
import VersionList from '../components/VersionList.jsx';
import CommentList from '../components/CommentList.jsx';
import AuditTrail from '../components/AuditTrail.jsx';
import ReviewDecisionPanel from '../components/ReviewDecisionPanel.jsx';

const MAX_TEXT = 10000;
const REVIEWABLE = ['draft', 'checked']; // same rule as the server (review and decisions)
const EDITABLE = ['draft', 'checked', 'changes_requested']; // new versions (edit, apply fixes)

// Scrolls `container` so that `el` sits in the middle of it. Only the container moves,
// never the whole page, so the text pane and the findings pane can both be aligned.
function centerIn(container, el) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const top = container.scrollTop + (r.top - c.top) - c.height / 2 + r.height / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export default function DraftReview() {
  const { id } = useParams();
  const [data, setData] = useState(null); // { draft, text, findings, comments, versions, reviews } for the CURRENT version
  const [me, setMe] = useState(null); // { user, workspace }
  const [sources, setSources] = useState({}); // code -> { title, text }
  const [loadError, setLoadError] = useState('');
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState(null); // mode of the last review run in this session
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('findings'); // 'findings' | 'comments' | 'history'

  // Older versions: null means "the current version".
  const [viewVersion, setViewVersion] = useState(null);
  const [oldData, setOldData] = useState(null); // { text, findings } of viewVersion
  const [oldError, setOldError] = useState('');

  // Editing the text by hand ("Save new version").
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const cardRefs = useRef({});
  const textScrollRef = useRef(null); // scrollable draft text pane
  const findingsScrollRef = useRef(null); // scrollable list of finding cards
  const [scrollRequest, setScrollRequest] = useState(null); // { id, source, n } set by select()

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
    setViewVersion(null);
    setEditing(false);
    setNotice('');
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

  const currentVersion = data?.draft.currentVersion;
  const viewingOld = viewVersion !== null && viewVersion !== currentVersion;

  // Load an older version (read-only) when one is picked.
  useEffect(() => {
    setOldData(null);
    setOldError('');
    if (!viewingOld) return undefined;
    let cancelled = false;
    api
      .get(`/api/drafts/${id}/versions/${viewVersion}`)
      .then((res) => !cancelled && setOldData({ text: res.text, findings: res.findings }))
      .catch((err) => !cancelled && setOldError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, viewVersion, viewingOld]);

  const shownText = viewingOld ? oldData?.text ?? '' : data?.text ?? '';
  const shownFindings = viewingOld ? oldData?.findings ?? [] : data?.findings ?? [];
  const sorted = useMemo(
    () => [...shownFindings].sort((a, b) => a.start - b.start || a.end - b.end),
    [shownFindings]
  );
  const selectedIndex = sorted.findIndex((f) => f._id === selectedId);

  // After a selection has rendered, bring the highlight AND its card into view together.
  // Two columns: each pane scrolls by itself. One column (narrow screens): scroll to the
  // pane the user did not click in.
  useEffect(() => {
    if (!scrollRequest) return;
    const card = document.getElementById(`card-${scrollRequest.id}`);
    const mark = document.getElementById(`hl-${scrollRequest.id}`);
    if (window.matchMedia('(min-width: 1024px)').matches) {
      centerIn(textScrollRef.current, mark);
      centerIn(findingsScrollRef.current, card);
    } else {
      (scrollRequest.source === 'card' ? mark : card)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [scrollRequest]);

  async function runReview() {
    setRunning(true);
    setActionError('');
    setNotice('');
    try {
      const result = await api.post(`/api/drafts/${id}/review`);
      setMode(result.mode);
      setSelectedId(null);
      setViewVersion(null);
      await load(); // reload so the page shows the saved findings and the new status
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRunning(false);
    }
  }

  // Passed to every FindingCard. Errors are thrown so the card can show them.
  async function decide(findingId, payload) {
    const updated = await api.patch(`/api/findings/${findingId}`, payload);
    setNotice('');
    setData((d) => ({ ...d, findings: d.findings.map((f) => (f._id === updated._id ? updated : f)) }));
  }

  async function applyFixes() {
    setApplying(true);
    setActionError('');
    setNotice('');
    try {
      const result = await api.post(`/api/drafts/${id}/apply-accepted`);
      setSelectedId(null);
      setViewVersion(null);
      await load();
      const skipped = result.skipped ? ` ${result.skipped} could not be applied.` : '';
      setNotice(`Applied ${result.applied} ${result.applied === 1 ? 'fix' : 'fixes'}. Version ${result.version} is now current. Run review to check it.${skipped}`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setApplying(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setActionError('');
    setNotice('');
    try {
      const result = await api.put(`/api/drafts/${id}/text`, { text: editText });
      setEditing(false);
      setSelectedId(null);
      setViewVersion(null);
      await load();
      setNotice(`Saved as version ${result.version}. Run review to check it.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Creator: "checked" -> "submitted". The server re-checks every rule.
  async function submitForApproval() {
    setSubmitting(true);
    setActionError('');
    setNotice('');
    try {
      await api.post(`/api/drafts/${id}/submit`);
      setSelectedId(null);
      setViewVersion(null);
      await load();
      setNotice('Submitted for approval. A reviewer will look at it next.');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Called by ReviewDecisionPanel after the server accepted the decision.
  async function onDecided(decision) {
    setViewVersion(null);
    await load();
    setNotice(decision === 'approved' ? 'Approved. The draft is now read-only.' : 'Changes requested. The creator can see your note.');
  }

  // Passed to CommentList. Throws on failure so the form can show the error.
  async function addComment(text) {
    const comment = await api.post(`/api/drafts/${id}/comments`, { text });
    setData((d) => ({ ...d, comments: [...d.comments, comment] }));
  }

  // source: 'text' (highlight clicked), 'card' (card clicked) or 'nav' (Previous/Next).
  function select(findingId, source = 'nav') {
    setSelectedId(findingId);
    setTab('findings'); // the card must be on screen before we scroll to it (see the effect above)
    setScrollRequest({ id: findingId, source, n: Date.now() });
  }

  // Previous / Next over the findings in text order, wrapping around at both ends.
  function stepSelection(delta) {
    const n = sorted.length;
    if (n === 0) return;
    const next = selectedIndex === -1 ? (delta > 0 ? 0 : n - 1) : (selectedIndex + delta + n) % n;
    select(sorted[next]._id, 'nav');
  }

  function viewOf(n) {
    setViewVersion(n === currentVersion ? null : n);
    setEditing(false);
    setSelectedId(null);
  }

  if (loadError) {
    return (
      <div>
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Could not load this draft: {loadError}
        </p>
        <Link to="/drafts" className="mt-3 inline-block text-sm underline">Back to drafts</Link>
      </div>
    );
  }
  if (!data || !me) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading draft…
      </p>
    );
  }

  const { draft, versions } = data;
  const comments = data.comments || [];
  const reviews = data.reviews || [];
  const role = me.user.role;
  const isAuthor = role === 'creator' || role === 'admin';
  const rulesOnlyWorkspace = me.workspace?.aiEnabled === false;
  const canReview = isAuthor && REVIEWABLE.includes(draft.status) && !viewingOld && !editing;
  const canEdit = isAuthor && EDITABLE.includes(draft.status) && !viewingOld;
  const canDecide = canReview; // same statuses, current version, not while editing
  const acceptedCount = data.findings.filter((f) => f.decision === 'accepted' || f.decision === 'edited').length;
  const pendingHigh = data.findings.filter((f) => f.severity === 'high' && f.decision === 'pending').length;
  // SRS 7.6: only a creator submits. The server also needs status "checked" (reviewed version).
  const canSubmit = role === 'creator' && draft.status === 'checked' && !viewingOld && !editing;
  const canDecideReview = (role === 'reviewer' || role === 'admin') && draft.status === 'submitted' && !viewingOld;
  const lastChangeRequest = [...reviews].reverse().find((r) => r.decision === 'changes_requested');
  const lastApproval = [...reviews].reverse().find((r) => r.decision === 'approved');
  const backTo = role === 'reviewer' ? '/queue' : '/drafts';
  const busy = running || applying || saving || submitting;
  const unchanged = editText === data.text;
  const tooLong = editText.length > MAX_TEXT;

  const primaryBtn =
    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900';
  const tabBtn = (active) =>
    `rounded-md px-3 py-1.5 text-sm font-medium focus:outline focus:outline-2 focus:outline-slate-900 ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

  return (
    <div>
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={14} aria-hidden="true" /> Back
      </Link>

      <header className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{draft.title}</h1>
        <StatusPill status={draft.status} />
        <div className="flex items-center gap-2">
          <label htmlFor="version" className="text-sm text-slate-600">Version</label>
          <select
            id="version"
            value={viewVersion ?? currentVersion}
            onChange={(e) => viewOf(Number(e.target.value))}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
          >
            {[...versions].sort((a, b) => b.version - a.version).map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}{v.version === currentVersion ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setEditText(data.text);
                setEditing(true);
                setActionError('');
              }}
              disabled={busy}
              className={`${primaryBtn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}
            >
              <PencilLine size={16} aria-hidden="true" /> Edit text
            </button>
          )}
          {canEdit && !editing && (
            <button
              type="button"
              onClick={applyFixes}
              disabled={busy || acceptedCount === 0}
              title={acceptedCount === 0 ? 'Accept or edit at least one finding first' : undefined}
              className={`${primaryBtn} bg-emerald-700 text-white hover:bg-emerald-600`}
            >
              {applying ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}
              {applying ? 'Applying…' : `Apply accepted fixes${acceptedCount ? ` (${acceptedCount})` : ''}`}
            </button>
          )}
          {canReview && (
            <button type="button" onClick={runReview} disabled={busy} className={`${primaryBtn} bg-teal-800 text-white hover:bg-teal-700`}>
              {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {running ? 'Reviewing…' : 'Run review'}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              onClick={submitForApproval}
              disabled={busy || pendingHigh > 0}
              title={pendingHigh > 0 ? 'Accept, edit or dismiss every high severity finding first' : undefined}
              className={`${primaryBtn} bg-violet-700 text-white hover:bg-violet-600`}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              {submitting ? 'Submitting…' : 'Submit for approval'}
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <ReviewStatusPanel
          findings={shownFindings}
          status={draft.status}
          role={role}
          viewingOld={viewingOld}
          mode={mode}
          rulesOnlyWorkspace={rulesOnlyWorkspace}
          lastApproval={lastApproval}
        />
        {draft.status === 'changes_requested' && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <MessageSquareWarning size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {lastChangeRequest?.reviewerId?.name ? `${lastChangeRequest.reviewerId.name} asked for changes` : 'A reviewer asked for changes'}
              {lastChangeRequest?.note ? `: ${lastChangeRequest.note}` : '.'}
            </span>
          </div>
        )}
        {viewingOld && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900">
            <Eye size={18} className="shrink-0" aria-hidden="true" />
            You are viewing version {viewVersion}. It is read-only.
            <button type="button" onClick={() => setViewVersion(null)} className="font-medium underline focus:outline focus:outline-2 focus:outline-slate-900">
              Back to version {currentVersion}
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{notice}</p>
        )}
        {actionError && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{actionError}</p>
        )}
        {canDecideReview && <ReviewDecisionPanel draftId={id} onDone={onDecided} />}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section aria-label="Draft text" className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Draft text{viewingOld ? ` (version ${viewVersion})` : ''}
          </h2>
          {editing ? (
            <div className="space-y-3">
              <label htmlFor="edit-text" className="sr-only">Edit draft text</label>
              <textarea
                id="edit-text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={12}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-[15px] leading-7 focus:outline focus:outline-2 focus:outline-slate-900"
              />
              <p className={`text-xs ${tooLong ? 'font-semibold text-red-700' : 'text-slate-500'}`} aria-live="polite">
                {editText.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} characters
                {tooLong && ' - too long, shorten the text'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving || unchanged || tooLong || editText.trim().length === 0}
                  className={`${primaryBtn} bg-slate-900 text-white hover:bg-slate-700`}
                >
                  {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  Save new version
                </button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className={`${primaryBtn} text-slate-700 underline`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : viewingOld && !oldData && !oldError ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading version {viewVersion}…
            </p>
          ) : oldError ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
              Could not load this version: {oldError}
            </p>
          ) : (
            <div ref={textScrollRef} className="p-2 lg:max-h-[68vh] lg:overflow-y-auto">
              <HighlightedText text={shownText} findings={sorted} selectedId={selectedId} onSelect={select} />
            </div>
          )}
        </section>

        <section aria-label="Findings, comments and history">
          <div className="mb-3 flex flex-wrap items-center gap-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'findings'} onClick={() => setTab('findings')} className={tabBtn(tab === 'findings')}>
              Findings ({shownFindings.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')} className={tabBtn(tab === 'comments')}>
              <span className="inline-flex items-center gap-1"><MessageSquare size={14} aria-hidden="true" /> Comments ({comments.length})</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabBtn(tab === 'history')}>
              <span className="inline-flex items-center gap-1"><History size={14} aria-hidden="true" /> History ({versions.length})</span>
            </button>
          </div>

          {tab === 'history' ? (
            <>
              <VersionList versions={versions} currentVersion={currentVersion} viewing={viewVersion ?? currentVersion} onView={viewOf} />
              <AuditTrail draftId={id} refreshKey={draft.updatedAt} />
            </>
          ) : tab === 'comments' ? (
            <CommentList comments={comments} onAdd={addComment} />
          ) : (
            <>
              {running && sorted.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking against guidelines and facts…
                </p>
              )}
              {!running && !(viewingOld && !oldData && !oldError) && sorted.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-700">
                  {viewingOld
                    ? 'No findings were recorded for this version.'
                    : draft.status === 'draft'
                      ? canReview
                        ? 'Run review to see issues, with the rule or fact behind each one.'
                        : 'This draft has not been reviewed yet.'
                      : 'No issues found in this version.'}
                </div>
              )}
              {sorted.length > 0 && (
                <div
                  role="toolbar"
                  aria-label="Finding navigation"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      stepSelection(1);
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      stepSelection(-1);
                    }
                  }}
                  className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-sm font-semibold text-slate-900" aria-live="polite">
                    {selectedIndex === -1
                      ? `No finding selected · ${sorted.length} in total`
                      : `Finding ${selectedIndex + 1} of ${sorted.length}`}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => stepSelection(-1)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline focus:outline-2 focus:outline-slate-900"
                    >
                      <ChevronUp size={14} aria-hidden="true" /> Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => stepSelection(1)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline focus:outline-2 focus:outline-slate-900"
                    >
                      Next <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
              <div ref={findingsScrollRef} className="space-y-3 p-1 lg:max-h-[62vh] lg:overflow-y-auto">
                {sorted.map((f, i) => (
                  <FindingCard
                    key={f._id}
                    ref={(el) => (cardRefs.current[f._id] = el)}
                    finding={f}
                    index={i}
                    selected={f._id === selectedId}
                    onSelect={select}
                    sources={sources}
                    canDecide={canDecide && !busy}
                    onDecide={decide}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
