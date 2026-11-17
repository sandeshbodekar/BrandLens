import { z } from 'zod';
import { Term } from '../models/Term.js';
import { Clause } from '../models/Clause.js';
import { crudRouter } from './crud.js';

const schema = z.object({
  preferred: z.string().trim().min(1).max(100),
  banned: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
  clauseCode: z.string().trim().min(1).max(30),
  note: z.string().trim().max(500).default(''),
});

export default crudRouter({
  Model: Term,
  label: 'term',
  sort: { preferred: 1 },
  createSchema: schema,
  // "No source, no flag": a term must cite a clause that really exists in this workspace.
  checkWrite: async (req) => {
    const exists = await Clause.exists({
      workspaceId: req.workspaceId,
      code: req.body.clauseCode,
    });
    return exists ? null : `Clause ${req.body.clauseCode} does not exist`;
  },
});
