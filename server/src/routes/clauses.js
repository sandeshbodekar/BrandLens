import { z } from 'zod';
import { Clause, CLAUSE_CATEGORIES, SEVERITIES } from '../models/Clause.js';
import { Term } from '../models/Term.js';
import { crudRouter } from './crud.js';

// "code" is only accepted on create. Findings and terms refer to clauses by code,
// so renaming one later would leave dangling references. zod drops unknown keys,
// so a "code" sent with an update is silently ignored.
const editable = z.object({
  category: z.enum(CLAUSE_CATEGORIES),
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(2000),
  severityDefault: z.enum(SEVERITIES),
  active: z.boolean().default(true),
});
const createSchema = editable.extend({ code: z.string().trim().min(1).max(30) });

export default crudRouter({
  Model: Clause,
  label: 'clause',
  sort: { code: 1 },
  createSchema,
  updateSchema: editable,
  // A term cites a clause, so deleting that clause would leave the term without a source.
  checkDelete: async (clause, req) => {
    const term = await Term.findOne({ workspaceId: req.workspaceId, clauseCode: clause.code });
    return term
      ? `Cannot delete: the term "${term.preferred}" cites ${clause.code}. Change or delete that term first.`
      : null;
  },
});
