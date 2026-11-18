// SRS 8 step 3: the prompt. The system prompt is the SRS text word for word.
export const SYSTEM_PROMPT = `You are a brand-compliance reviewer. Review the DRAFT against ONLY the
CLAUSES and FACTS provided. Do not use outside knowledge or invent rules.
Report an issue only if you can cite a clause code or fact code from the lists.
Preserve the author's intent: suggestions must replace only the quoted text
and keep its meaning.
Return ONLY a JSON array, no prose, no markdown. Each item:
{
 "quote": "exact text copied from the DRAFT",
 "type": "tone|terminology|claim|fact_conflict|outdated_fact|legal|other",
 "severity": "high|medium|low",
 "clauseCode": "code from CLAUSES or null",
 "factCode": "code from FACTS or null",
 "explanation": "one sentence, under 30 words, saying why this breaks the cited source",
 "suggestion": "replacement for the quote only",
 "confidence": 0.0-1.0
}
If there are no issues return [].`;

// SRS 8: CLAUSES:\n<code>: <title> - <text>\n...\n\nFACTS (valid today):\n<code>: <statement>\n...\n\nDRAFT:\n<masked text>
// `clauses` must be the ACTIVE clauses and `facts` the facts VALID today, so the
// model can only be given (and so only cite) sources that may really be cited.
export function buildUserMessage({ clauses, facts, maskedText }) {
  const clauseLines = clauses.map((c) => `${c.code}: ${c.title} - ${c.text}`).join('\n');
  const factLines = facts.map((f) => `${f.code}: ${f.statement}`).join('\n');
  return `CLAUSES:\n${clauseLines}\n\nFACTS (valid today):\n${factLines}\n\nDRAFT:\n${maskedText}`;
}
