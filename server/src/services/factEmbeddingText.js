import { createHash } from 'node:crypto';

// Pure helpers for fact embeddings (no database, no network), kept apart so they are easy to test.

// The text that represents a fact in embedding space. The approved wording is included
// ("Rs 109") because claims quote it. Stale variants are NOT included: they are the old,
// wrong values, and adding them would make an outdated claim look supported.
export function factEmbeddingText(fact) {
  const statement = String(fact.statement || '').trim();
  const approved = String(fact.currentText || '').trim();
  return approved ? `${statement} (Approved wording: ${approved})` : statement;
}

// Changes when the text, the embedding model or the vector size changes.
export function embeddingHash(text, model, dims) {
  return createHash('sha1').update(`${model}|${dims}|${text}`).digest('hex');
}

// Which of these facts need a new embedding? Pure, so it can be tested.
//   facts   objects with code, statement, currentText and (optionally) embeddingHash
//   force   re-embed everything
export function findStaleFacts(facts, { model, dims, force = false }) {
  return facts.filter((f) => force || f.embeddingHash !== embeddingHash(factEmbeddingText(f), model, dims));
}
