import mongoose from 'mongoose';

// SRS 5: Term { workspaceId, preferred, banned, clauseCode, note }
const termSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    preferred: { type: String, required: true, trim: true },
    banned: { type: [String], default: [] },
    clauseCode: { type: String, required: true, trim: true }, // the clause that justifies this term
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export const Term = mongoose.model('Term', termSchema);
