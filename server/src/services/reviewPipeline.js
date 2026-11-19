import { Clause } from '../models/Clause.js';
import { Term } from '../models/Term.js';
import { Fact } from '../models/Fact.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { Finding } from '../models/Finding.js';
import { complete, isLlmConfigured } from '../llm/index.js';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt.js';
import { segment } from './segment.js';
import { runRuleChecks } from './ruleChecks.js';
import { maskPii } from './piiMask.js';
import { verifyAiFindings } from './verifier.js';
import { classifyAiFailure, AI_REASONS } from './aiFailure.js';

// Steps 3 and 4 of SRS 8: ask the model, then verify its answer.
// Returns { findings, dropped } when the AI review worked, or { reason, message } when
// the review must fall back to rules only. It never throws: the review must never
// crash the request. Log lines name the reason but never contain draft text or the API key.
async function tryAiReview({ workspace, text, clauses, facts, ruleFindings }) {
  // An admin chose rules-only: not an error.
  if (workspace.aiEnabled === false) return { reason: 'disabled', message: AI_REASONS.disabled };
  if (!isLlmConfigured()) {
    console.warn('[review] AI review skipped: set LLM_PROVIDER (gemini), LLM_API_KEY and LLM_MODEL');
    return { reason: 'not_configured', message: AI_REASONS.not_configured };
  }
  if (!clauses.length && !facts.length) return { reason: 'disabled', message: AI_REASONS.disabled }; // nothing the model could cite

  const startedAt = Date.now();
  try {
    const raw = await complete({
      system: SYSTEM_PROMPT,
      // Only the masked copy leaves the server; the verifier still works on the original.
      user: buildUserMessage({ clauses, facts, maskedText: maskPii(text) }),
    });
    const result = verifyAiFindings({ raw, text, clauses, facts, ruleFindings });
    if (result.parseFailed) {
      console.warn('[review] AI answer was not a JSON array; using rules only');
      return { reason: 'parse_failed', message: AI_REASONS.parse_failed };
    }
    const aiCount = result.findings.filter((f) => f.origin === 'ai').length;
    console.log(`[review] AI review ok in ${Date.now() - startedAt} ms: ${aiCount} AI findings, ${result.dropped} dropped`);
    return result;
  } catch (err) {
    console.warn(`[review] AI review unavailable, using rules only: ${err.message}`);
    return classifyAiFailure(err);
  }
}

// SRS 8: the review pipeline.
//   1 segment, 2 rule checks, 3 LLM review, 4 verify, 5 persist.
// mode is 'ai+rules' when the model answered and its answer parsed, otherwise 'rules-only'.
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
  const ruleFindings = runRuleChecks({ text, sentences: segment(text), clauses, terms, facts });

  // Steps 3 and 4 (falls back to the rule findings if the AI is off or fails)
  let findings = ruleFindings;
  let mode = 'rules-only';
  let dropped = 0;
  let reason = null; // why the AI step did not run (null when mode is 'ai+rules')
  let message = null; // the same, as a sentence for the UI
  const ai = await tryAiReview({ workspace, text, clauses, facts, ruleFindings });
  if (ai.findings) {
    findings = ai.findings;
    dropped = ai.dropped;
    mode = 'ai+rules';
  } else {
    ({ reason, message } = ai);
  }

  // Step 5: replace this version's findings, then mark the draft as checked.
  await Finding.deleteMany({ draftId: draft._id, version });
  const saved = findings.length
    ? await Finding.insertMany(findings.map((f) => ({ ...f, draftId: draft._id, version })))
    : [];
  draft.status = 'checked';
  await draft.save();

  // `reason` and `message` are additions to the SRS response { findings, mode, dropped }.
  return { findings: saved, mode, dropped, reason, message };
}
