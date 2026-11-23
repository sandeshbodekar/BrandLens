import mongoose from 'mongoose';

// SRS 5: Fact { workspaceId, code, statement, currentText, staleVariants,
//               validFrom, validTo, active }
const factSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    code: { type: String, required: true, trim: true }, // e.g. "F-20"
    statement: { type: String, required: true, trim: true },
    currentText: { type: String, default: '', trim: true }, // optional, e.g. "Rs 109"
    staleVariants: { type: [String], default: [] }, // e.g. ["Rs 99", "₹99"]
    validFrom: { type: Date, required: true },
    validTo: { type: Date, default: null },
    active: { type: Boolean, default: true },

    // Round 3: the fact's embedding, used to match claims in a draft to the closest facts.
    // All three are hidden from normal queries (select: false), so the 768 numbers never
    // reach the Knowledge page or any API response. Read them with .select('+embedding').
    // embeddingHash says which text, model and size the vector was made from, so a changed
    // fact (or a changed model) is noticed and re-embedded; nothing else is recomputed.
    embedding: { type: [Number], select: false, default: undefined },
    embeddingModel: { type: String, select: false },
    embeddingHash: { type: String, select: false },
  },
  { timestamps: true }
);

factSchema.index({ workspaceId: 1, code: 1 }, { unique: true });

// SRS 7.2: a fact is VALID when active, validFrom <= today and
// (validTo is null or validTo >= today). The review pipeline (Phase 3) uses this
// filter to pick the facts it may cite. Dates are compared as UTC days.
factSchema.statics.validFilter = function validFilter(workspaceId, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    workspaceId,
    active: true,
    validFrom: { $lte: today },
    $or: [{ validTo: null }, { validTo: { $gte: today } }],
  };
};

export const Fact = mongoose.model('Fact', factSchema);
