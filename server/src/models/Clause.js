import mongoose from 'mongoose';

export const CLAUSE_CATEGORIES = ['tone', 'terminology', 'claims', 'legal', 'visual', 'accessibility'];
export const SEVERITIES = ['high', 'medium', 'low'];

// SRS 5: Clause { workspaceId, code, category, title, text, severityDefault, active }
const clauseSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    code: { type: String, required: true, trim: true }, // e.g. "C-4.2"
    category: { type: String, enum: CLAUSE_CATEGORIES, required: true },
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    severityDefault: { type: String, enum: SEVERITIES, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A code is unique inside a workspace (two workspaces may both have "C-4.2").
clauseSchema.index({ workspaceId: 1, code: 1 }, { unique: true });

export const Clause = mongoose.model('Clause', clauseSchema);
