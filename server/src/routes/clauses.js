import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { Clause, CLAUSE_CATEGORIES, SEVERITIES } from '../models/Clause.js';
import { Term } from '../models/Term.js';
import { logAudit } from '../services/audit.js';
import { parseGuidelines, MAX_IMPORT_CHARS, MAX_IMPORT_CLAUSES } from '../services/guidelineImport.js';
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

const importSchema = z.object({
  text: z
    .string()
    .max(MAX_IMPORT_CHARS)
    .refine((t) => t.trim().length > 0, 'text must not be empty'),
});
// The preview rows carry an extra "problem" field; zod drops it, only real clause fields are kept.
const bulkSchema = z.object({ clauses: z.array(createSchema).min(1).max(MAX_IMPORT_CLAUSES) });

const adminOnly = requireRole('admin');
const codesOf = async (workspaceId) => (await Clause.find({ workspaceId }).select('code').lean()).map((c) => c.code);

// Registered BEFORE the generic CRUD routes. Neither path clashes with them (POST /, PUT /:id).
const importRouter = Router();

// POST /api/clauses/import {text} -> { clauses: [...preview rows], skipped } (SRS 7.2). Saves nothing.
importRouter.post('/import', auth, adminOnly, validate(importSchema), async (req, res, next) => {
  try {
    const result = parseGuidelines(req.body.text, { existingCodes: await codesOf(req.workspaceId) });
    if (result.clauses.length === 0) {
      return res.status(400).json({ message: 'No clauses found. Separate each guideline with a blank line.' });
    }
    if (result.clauses.length > MAX_IMPORT_CLAUSES) {
      return res.status(400).json({ message: `Too many clauses (max ${MAX_IMPORT_CLAUSES} per import). Import the text in smaller parts.` });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/clauses/bulk {clauses: [...]} -> the saved clauses (SRS 7.2). The admin has
// reviewed (and maybe edited) the preview. Every row is validated again here, because the
// request could come from anywhere, not only from our page.
importRouter.post('/bulk', auth, adminOnly, validate(bulkSchema), async (req, res, next) => {
  try {
    const wanted = req.body.clauses;
    const seen = new Set();
    for (const c of wanted) {
      const lower = c.code.toLowerCase();
      if (seen.has(lower)) return res.status(400).json({ message: `The code "${c.code}" appears twice in this import` });
      seen.add(lower);
    }
    const existing = new Set((await codesOf(req.workspaceId)).map((c) => c.toLowerCase()));
    const clash = wanted.find((c) => existing.has(c.code.toLowerCase()));
    if (clash) return res.status(409).json({ message: `A clause with the code "${clash.code}" already exists` });

    let saved;
    try {
      // workspaceId always comes from the token, never from the request body.
      saved = await Clause.insertMany(wanted.map((c) => ({ ...c, workspaceId: req.workspaceId })));
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: 'One of these codes was just added by someone else. Run the import again.' });
      }
      throw err;
    }
    await logAudit({
      workspaceId: req.workspaceId,
      actorId: req.user._id,
      action: 'clauses_imported',
      entity: 'Workspace',
      entityId: req.workspaceId,
      meta: { count: saved.length },
    });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

const router = Router();
router.use(importRouter);
router.use(
  crudRouter({
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
  })
);

export default router;
