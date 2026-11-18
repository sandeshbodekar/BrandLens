import mongoose from 'mongoose';
import { SEVERITIES } from './Clause.js';

export const FINDING_TYPES = ['tone', 'terminology', 'claim', 'fact_conflict', 'outdated_fact', 'legal', 'other'];
export const FINDING_ORIGINS = ['rule', 'ai'];
export const FINDING_DECISIONS = ['pending', 'accepted', 'edited', 'dismissed'];

// SRS 5: Finding. [start, end) are character offsets into the text of `version`.
const findingSchema = new mongoose.Schema(
  {
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Draft', required: true },
    version: { type: Number, required: true, min: 1 },
    quote: { type: String, required: true },
    start: { type: Number, required: true, min: 0 },
    end: { type: Number, required: true, min: 0 },
    type: { type: String, enum: FINDING_TYPES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    clauseCode: { type: String, default: null },
    factCode: { type: String, default: null },
    explanation: { type: String, required: true },
    // Replacement for the quote. An empty string means "remove the quoted text"
    // (used when a rule can flag a problem but cannot know a better wording).
    suggestion: { type: String, default: '' },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    origin: { type: String, enum: FINDING_ORIGINS, required: true },
    decision: { type: String, enum: FINDING_DECISIONS, default: 'pending' },
    editedSuggestion: { type: String, default: null },
    decisionReason: { type: String, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

findingSchema.index({ draftId: 1, version: 1 });

export const Finding = mongoose.model('Finding', findingSchema);
