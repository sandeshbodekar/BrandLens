import { z } from 'zod';
import { Fact } from '../models/Fact.js';
import { crudRouter } from './crud.js';

// "" or a missing value means "no end date" -> null.
// z.coerce.date() turns "2026-10-01" (from <input type="date">) into a Date.
const dateOrNull = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.coerce.date().nullable()
);

const editable = z.object({
  statement: z.string().trim().min(1).max(500),
  currentText: z.string().trim().max(200).default(''),
  staleVariants: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  validFrom: z.coerce.date(),
  validTo: dateOrNull,
  active: z.boolean().default(true),
});

const endsAfterStart = [
  (f) => !f.validTo || f.validTo >= f.validFrom,
  { message: 'validTo must be on or after validFrom', path: ['validTo'] },
];

// Same rule as clauses: the code is set once, on create.
const createSchema = editable
  .extend({ code: z.string().trim().min(1).max(30) })
  .refine(...endsAfterStart);
const updateSchema = editable.refine(...endsAfterStart);

export default crudRouter({
  Model: Fact,
  label: 'fact',
  sort: { code: 1 },
  createSchema,
  updateSchema,
});
