import { useParams } from 'react-router-dom';

// Placeholder. Built in Phase 4 (findings screen) and Phases 5 to 6.
export default function DraftReview() {
  const { id } = useParams();
  return (
    <section>
      <h1 className="text-xl font-semibold text-slate-900">Draft review</h1>
      <p className="mt-2 text-sm text-slate-600">Draft {id}. Coming in Phase 4.</p>
    </section>
  );
}
