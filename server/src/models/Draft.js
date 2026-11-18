import mongoose from 'mongoose';

export const CONTENT_TYPES = ['post', 'ad', 'email', 'document'];
export const DRAFT_STATUSES = ['draft', 'checked', 'submitted', 'approved', 'changes_requested'];

// SRS 5: Draft { workspaceId, title, contentType, createdBy, status, currentVersion }
const draftSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: DRAFT_STATUSES, default: 'draft' },
    currentVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Draft = mongoose.model('Draft', draftSchema);
