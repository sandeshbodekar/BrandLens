import { Clause } from '../models/Clause.js';
import { Term } from '../models/Term.js';
import { Fact } from '../models/Fact.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { Finding } from '../models/Finding.js';
import { segment } from './segment.js';
import { runRuleChecks } from './ruleChecks.js';

// SRS 8: the review pipeline.
// Phase 3a runs steps 1 (segment), 2 (rule checks) and 5 (persist).
// Phase 3b adds steps 3 (LLM) and 4 (verifier) between the rules and the save,
// and sets mode to 'ai+rules' when the model answered.
export async function runReview({ draft, workspace }) {
  const version = draft.currentVersion;
  const versionDoc = await DraftVersion.findOne({ draftId: draft._id, version });
  if (!versionDoc) throw new Error(`Version ${version} of draft ${draft._id} not found`);
  const text = versionDoc.text;

  // Only active clauses and currently valid facts can be cited.
  const [clauses, terms, facts] = await Promise.all([
    Clause.find({ workspaceId: workspace._id, active: true }).lean(),
    Term.find({ workspaceId: workspace._id }).lean(),
    Fact.find(Fact.validFilter(workspace._id)).lean(),
  ]);

  // Steps 1 and 2
  const findings = runRuleChecks({ text, sentences: segment(text), clauses, terms, facts });
  const mode = 'rules-only';
  const dropped = 0;

  // Step 5: replace this version's findings, then mark the draft as checked.
  await Finding.deleteMany({ draftId: draft._id, version });
  const saved = findings.length
    ? await Finding.insertMany(findings.map((f) => ({ ...f, draftId: draft._id, version })))
    : [];
  draft.status = 'checked';
  await draft.save();

  return { findings: saved, mode, dropped };
}
