import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ResourceTab from '../components/ResourceTab.jsx';
import WorkspaceSettings from '../components/WorkspaceSettings.jsx';
import ClauseImport from '../components/ClauseImport.jsx';
import { RESOURCES } from '../knowledgeConfig.jsx';

// SRS 9: three tabs (Clauses, Facts, Terms). Everyone can read; only admin can write.
// The knowledge base is small, so all three lists are loaded up front.
export default function Knowledge() {
  const { user } = useAuth();
  const canWrite = user.role === 'admin';
  const [tab, setTab] = useState('clauses');
  const [data, setData] = useState({ clauses: [], facts: [], terms: [] });
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0); // bump to retry (also used after a demo reset)

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all(Object.values(RESOURCES).map((r) => api.get(r.path)))
      .then(([clauses, facts, terms]) => {
        if (cancelled) return;
        setData({ clauses, facts, terms });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // After a save/delete, reload just that list. Terms read the clause list for their dropdown.
  const reload = useCallback(async (key) => {
    const items = await api.get(RESOURCES[key].path);
    setData((d) => ({ ...d, [key]: items }));
  }, []);

  return (
    <section>
      <h1 className="text-xl font-semibold text-slate-900">Knowledge base</h1>
      <p className="mt-1 text-sm text-slate-700">
        {canWrite
          ? 'You are an admin: you can add, edit and delete items.'
          : 'Read-only access: only admins can change the knowledge base.'}
      </p>

      {canWrite && <WorkspaceSettings onReset={() => setAttempt((n) => n + 1)} />}

      {status === 'loading' && (
        <div className="mt-8 flex items-center gap-2 text-slate-600" role="status">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading knowledge base…
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>Could not load the knowledge base: {error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-red-900 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div role="tablist" aria-label="Knowledge base sections" className="mt-5 flex gap-1 border-b border-slate-200">
            {Object.values(RESOURCES).map((r) => {
              const active = tab === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  id={`tab-${r.key}`}
                  aria-selected={active}
                  aria-controls={`panel-${r.key}`}
                  onClick={() => setTab(r.key)}
                  className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.title} ({data[r.key].length})
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
            {/* SRS 7.2: paste-import of guidelines (admin, Clauses tab only) */}
            {tab === 'clauses' && canWrite && <ClauseImport clauses={data.clauses} onSaved={() => reload('clauses')} />}
            {/* key resets the form state when switching tabs */}
            <ResourceTab
              key={tab}
              config={RESOURCES[tab]}
              items={data[tab]}
              ctx={{ clauses: data.clauses }}
              canWrite={canWrite}
              onChanged={() => reload(tab)}
            />
          </div>
        </>
      )}
    </section>
  );
}
