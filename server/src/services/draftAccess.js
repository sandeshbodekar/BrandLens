import mongoose from 'mongoose';
import { Draft } from '../models/Draft.js';

const REVIEWER_STATUSES = ['submitted', 'approved', 'changes_requested'];

// SRS 7.3 visibility: creators see their own drafts, reviewers see drafts that
// have been submitted, admins see everything. Always inside the user's workspace.
export function visibleTo(user, workspaceId) {
  const filter = { workspaceId };
  if (user.role === 'creator') filter.createdBy = user._id;
  if (user.role === 'reviewer') filter.status = { $in: REVIEWER_STATUSES };
  return filter;
}

// Loads a draft the current user is allowed to see, or answers 400/404 itself.
// A draft hidden from this user gets 404 (not 403), so its existence is not revealed.
export async function loadVisibleDraft(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Invalid id' });
    return null;
  }
  const draft = await Draft.findOne({ _id: req.params.id, ...visibleTo(req.user, req.workspaceId) });
  if (!draft) {
    res.status(404).json({ message: 'Draft not found' });
    return null;
  }
  return draft;
}
