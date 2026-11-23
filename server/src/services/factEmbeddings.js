import { Fact } from '../models/Fact.js';
import { config } from '../config.js';
import { embedTexts, isEmbedConfigured } from '../llm/embed.js';
import { classifyAiFailure } from './aiFailure.js';
import { factEmbeddingText, embeddingHash, findStaleFacts } from './factEmbeddingText.js';

// Makes sure every active fact of a workspace has an up-to-date embedding.
// Never throws: the callers are a knowledge-base save and a review, and neither may fail
// because of the embedding service. The answer says what happened:
//   { configured, total, embedded, skipped, failed, reason?, message? }
export async function ensureFactEmbeddings(workspaceId, { force = false, embed = embedTexts, configured = isEmbedConfigured() } = {}) {
  if (!configured) {
    return { configured: false, total: 0, embedded: 0, skipped: 0, failed: 0, reason: 'not_configured', message: 'LLM_EMBED_MODEL is not set.' };
  }
  const { embedModel: model, embedDimensions: dims } = config.llm;

  try {
    const facts = await Fact.find({ workspaceId, active: true }).select('+embeddingHash');
    const stale = findStaleFacts(facts, { model, dims, force });
    const result = { configured: true, total: facts.length, embedded: 0, skipped: facts.length - stale.length, failed: 0 };
    if (!stale.length) return result;

    let vectors;
    try {
      vectors = await embed(stale.map(factEmbeddingText), { kind: 'document', titles: stale.map((f) => f.code) });
    } catch (err) {
      console.warn(`[embed] could not embed ${stale.length} fact(s): ${err.message}`);
      return { ...result, failed: stale.length, ...classifyAiFailure(err) };
    }

    await Fact.bulkWrite(
      stale.map((fact, i) => ({
        updateOne: {
          filter: { _id: fact._id },
          update: {
            $set: {
              embedding: vectors[i],
              embeddingModel: model,
              embeddingHash: embeddingHash(factEmbeddingText(fact), model, dims),
            },
          },
        },
      }))
    );
    return { ...result, embedded: stale.length };
  } catch (err) {
    console.warn(`[embed] fact embedding failed: ${err.message}`);
    return { configured: true, total: 0, embedded: 0, skipped: 0, failed: 0, reason: 'error', message: 'Fact embeddings could not be updated.' };
  }
}
