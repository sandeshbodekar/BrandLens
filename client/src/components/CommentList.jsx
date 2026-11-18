import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// Comments tab: the list and the add form. `onAdd(text)` is async and throws on failure.
export default function CommentList({ comments, onAdd }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setPosting(true);
    setError('');
    try {
      await onAdd(text.trim());
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-6 py-8 text-center text-sm text-slate-700">
          No comments yet.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Comments">
          {comments.map((c) => (
            <li key={c._id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                <span className="text-sm font-semibold text-slate-900">{c.authorId?.name || 'Unknown user'}</span>
                {c.authorId?.role && <span className="rounded bg-slate-100 px-1.5 py-0.5 capitalize">{c.authorId.role}</span>}
                <span>on version {c.version}</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="new-comment" className="text-sm font-medium text-slate-800">Add a comment</label>
        <textarea
          id="new-comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={posting}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
        />
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
        )}
        <button
          type="submit"
          disabled={posting || text.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
        >
          {posting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Post comment
        </button>
      </form>
    </div>
  );
}
