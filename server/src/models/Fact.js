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
