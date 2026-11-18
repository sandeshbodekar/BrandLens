import mongoose from 'mongoose';

// SRS 5: Comment { draftId, version, authorId, text, anchorStart, anchorEnd }
// The anchors are optional (anchored comments are a "should have"); the API accepts them.
const commentSchema = new mongoose.Schema(
  {
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draft', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    anchorStart: { type: Number, default: null, min: 0 },
    anchorEnd: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

// Oldest first, with the author's name and role filled in for the UI.
commentSchema.statics.forDraft = function forDraft(draftId) {
  return this.find({ draftId }).sort({ createdAt: 1, _id: 1 }).populate('authorId', 'name role');
};

export const Comment = mongoose.model('Comment', commentSchema);
