import { useState } from 'react';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

// Zod errors arrive as [{path, message}]; show them instead of the generic "Invalid request".
function describeError(err) {
  if (err.details?.length) return err.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  return err.message || 'Something went wrong';
}

function Field({ field, value, onChange, ctx, locked, idPrefix }) {
  const id = `${idPrefix}-${field.name}`;

  if (field.type === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-center gap-2 self-end pb-2 text-sm text-slate-800">
        <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
        {field.label}
      </label>
    );
  }

  let control;
  if (field.type === 'textarea' || field.type === 'lines') {
    control = (
      <textarea
        id={id}
        rows={field.type === 'lines' ? 3 : 2}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    );
  } else if (field.type === 'select') {
    const options = typeof field.options === 'function' ? field.options(ctx) : field.options;
    control = (
      <select id={id} required={field.required} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {field.placeholder && <option value="">{field.placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        id={id}
        type={field.type === 'date' ? 'date' : 'text'}
        required={field.required}
        disabled={locked}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <div className={field.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-xs text-slate-600">{field.help}</p>}
    </div>
  );
}

// Generic table + add/edit form + delete confirmation for one resource.
// canWrite=false (creator, reviewer) hides every write control; the server enforces it too.
export default function ResourceTab({ config, items, ctx, canWrite, onChanged }) {
  const [editing, setEditing] = useState(null); // null, or { item } (item = null when adding)
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function openForm(item) {
    setEditing({ item });
    setForm(item ? config.toForm(item) : config.emptyForm());
    setFormError('');
  }
  function closeForm() {
    setEditing(null);
    setForm(null);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = config.toPayload(form);
      if (editing.item) await api.put(`${config.path}/${editing.item._id}`, payload);
      else await api.post(config.path, payload);
      await onChanged();
      closeForm();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`${config.path}/${toDelete._id}`);
      await onChanged();
      setToDelete(null);
    } catch (err) {
      setDeleteError(describeError(err)); // e.g. "Cannot delete: the term ... cites T-1"
    } finally {
      setDeleting(false);
    }
  }

  const showActions = canWrite;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-700">{config.description}</p>
        {canWrite && !editing && (
          <button
            type="button"
            onClick={() => openForm(null)}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add {config.singular}
          </button>
        )}
      </div>

      {editing && form && (
        <form onSubmit={save} className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">
            {editing.item ? `Edit ${config.singular} ${config.describe(editing.item)}` : `Add ${config.singular}`}
          </h3>
          {formError && (
            <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {config.fields.map((field) => (
              <Field
                key={field.name}
                field={field}
                value={form[field.name]}
                onChange={(v) => setForm((f) => ({ ...f, [field.name]: v }))}
                ctx={ctx}
                locked={field.lockedWhenEditing && !!editing.item}
                idPrefix={config.key}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* overflow-x-auto: wide tables scroll inside the card, not the whole page */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">{config.title}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {config.columns.map((col) => (
                <th key={col.header} scope="col" className="px-4 py-2 font-medium">
                  {col.header}
                </th>
              ))}
              {showActions && (
                <th scope="col" className="px-4 py-2 font-medium">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + (showActions ? 1 : 0)} className="px-4 py-6 text-center text-slate-600">
                  No {config.plural} yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item._id} className="align-top">
                {config.columns.map((col) => (
                  <td key={col.header} className="px-4 py-3 text-slate-800">
                    {col.render(item)}
                  </td>
                ))}
                {showActions && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openForm(item)}
                      aria-label={`Edit ${config.singular} ${config.describe(item)}`}
                      className="mr-1 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError('');
                        setToDelete(item);
                      }}
                      aria-label={`Delete ${config.singular} ${config.describe(item)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${config.singular}?`}
        message={toDelete ? `Delete ${config.singular} "${config.describe(toDelete)}"? This cannot be undone.` : ''}
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
