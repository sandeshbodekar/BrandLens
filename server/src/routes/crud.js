import { Router } from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';

// Builds GET / POST / PUT / DELETE for one knowledge-base collection.
// Used by clauses, facts and terms so the three routes behave identically.
//   - everyone logged in can read (SRS 7.2)
//   - only admin can write
//   - every query includes workspaceId, so one workspace can never touch another's data
//
// Options:
//   Model, label, sort       the Mongoose model, a name for messages, and the list order
//   createSchema/updateSchema zod schemas for the request body (update defaults to create)
//   checkWrite(req)          optional: return an error string to reject a create/update
//   checkDelete(doc, req)    optional: return an error string to block a delete
//   afterWrite(item, req)    optional: runs after a successful create or update. It is
//                            NOT awaited and its errors are only logged, so a slow or failing
//                            follow-up (e.g. fact embeddings) never delays or fails the save.
export function crudRouter({
  Model,
  label,
  sort,
  createSchema,
  updateSchema = createSchema,
  checkWrite,
  checkDelete,
  afterWrite,
}) {
  const router = Router();
  router.use(auth);
  const adminOnly = requireRole('admin');

  const validId = (req, res, next) =>
    mongoose.isValidObjectId(req.params.id)
      ? next()
      : res.status(400).json({ message: 'Invalid id' });

  // 11000 = Mongo duplicate-key error (the unique workspaceId+code index).
  const runAfterWrite = (item, req) => {
    if (!afterWrite) return;
    Promise.resolve()
      .then(() => afterWrite(item, req))
      .catch((err) => console.warn(`[${label}] follow-up after save failed: ${err.message}`));
  };

  const fail = (err, res, next) =>
    err?.code === 11000
      ? res.status(409).json({ message: `A ${label} with that code already exists` })
      : next(err);

  // numericOrdering makes "F-9" sort before "F-12" instead of after it.
  router.get('/', async (req, res, next) => {
    try {
      const items = await Model.find({ workspaceId: req.workspaceId })
        .sort(sort)
        .collation({ locale: 'en', numericOrdering: true });
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', adminOnly, validate(createSchema), async (req, res, next) => {
    try {
      const problem = checkWrite && (await checkWrite(req));
      if (problem) return res.status(400).json({ message: problem });
      // workspaceId always comes from the token, never from the request body.
      const item = await Model.create({ ...req.body, workspaceId: req.workspaceId });
      res.status(201).json(item);
      runAfterWrite(item, req);
    } catch (err) {
      fail(err, res, next);
    }
  });

  router.put('/:id', adminOnly, validId, validate(updateSchema), async (req, res, next) => {
    try {
      const problem = checkWrite && (await checkWrite(req));
      if (problem) return res.status(400).json({ message: problem });
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, workspaceId: req.workspaceId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!item) return res.status(404).json({ message: `${label} not found` });
      res.json(item);
      runAfterWrite(item, req);
    } catch (err) {
      fail(err, res, next);
    }
  });

  router.delete('/:id', adminOnly, validId, async (req, res, next) => {
    try {
      const item = await Model.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!item) return res.status(404).json({ message: `${label} not found` });
      const problem = checkDelete && (await checkDelete(item, req));
      if (problem) return res.status(409).json({ message: problem });
      await item.deleteOne();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
