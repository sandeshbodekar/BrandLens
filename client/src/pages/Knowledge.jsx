import { useAuth } from '../context/AuthContext.jsx';

// Placeholder. Built in Phase 2. Everyone can read; only admin gets write actions.
export default function Knowledge() {
  const { user } = useAuth();
  const canWrite = user.role === 'admin';
  return (
    <section>
      <h1 className="text-xl font-semibold text-slate-900">Knowledge base</h1>
      <p className="mt-2 text-sm text-slate-700">
        {canWrite
          ? 'Admin access: you will be able to add, edit and delete items here (Phase 2).'
          : 'Read-only access: only admins can change the knowledge base.'}
      </p>
    </section>
  );
}
