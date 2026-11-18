import mongoose from 'mongoose';

// SRS 5: DraftVersion { draftId, version, text, createdBy, note }
// The text of a draft is never edited in place: every change is a new version.
const draftVersionSchema = new mongoose.Schema(
  {
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draft', required: true },
    version: { type: Number, required: true, min: 1 },
    text: { type: String, required: true, maxlength: 10000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

draftVersionSchema.index({ draftId: 1, version: 1 }, { unique: true });

export const DraftVersion = mongoose.model('DraftVersion', draftVersionSchema);
