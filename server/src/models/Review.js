import mongoose from 'mongoose';

export const REVIEW_DECISIONS = ['approved', 'changes_requested'];

// SRS 5: Review { draftId, version, reviewerId, decision, note }
const reviewSchema = new mongoose.Schema(
  {
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draft', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: REVIEW_DECISIONS, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Review = mongoose.model('Review', reviewSchema);
