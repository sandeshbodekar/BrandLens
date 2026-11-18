import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { Clause } from '../models/Clause.js';
import { Fact } from '../models/Fact.js';
import { Term } from '../models/Term.js';
import { Draft } from '../models/Draft.js';
import { DraftVersion } from '../models/DraftVersion.js';
import { Finding } from '../models/Finding.js';
import { Comment } from '../models/Comment.js';
import { Review } from '../models/Review.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  WORKSPACE,
  DEMO_PASSWORD,
  DEMO_USERS,
  CLAUSES,
  FACTS,
  TERMS,
  SAMPLE_DRAFTS,
} from './brandData.js';

// Create the workspace and the 3 demo users if missing (upsert: never duplicates).
// Passwords are reset to the demo password on every run.
export async function ensureWorkspaceAndUsers() {
  const workspace = await Workspace.findOneAndUpdate(
    { name: WORKSPACE.name },
    { $setOnInsert: { description: WORKSPACE.description, aiEnabled: WORKSPACE.aiEnabled } },
    { upsert: true, new: true }
  );

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    await User.findOneAndUpdate(
      { email: u.email },
      { $set: { name: u.name, role: u.role, workspaceId: workspace._id, passwordHash } },
      { upsert: true, new: true }
    );
  }
  return workspace;
}

// Versions, findings, comments and reviews only carry a draftId, so find the
// workspace's drafts first. AuditLog has its own workspaceId.
async function wipeDrafts(workspaceId) {
  const ids = (await Draft.find({ workspaceId }).select('_id').lean()).map((d) => d._id);
  await Promise.all([
    Finding.deleteMany({ draftId: { $in: ids } }),
    DraftVersion.deleteMany({ draftId: { $in: ids } }),
    Comment.deleteMany({ draftId: { $in: ids } }),
    Review.deleteMany({ draftId: { $in: ids } }),
    AuditLog.deleteMany({ workspaceId }),
  ]);
  await Draft.deleteMany({ workspaceId });
}

// The 4 sample drafts, owned by the demo creator, each with version 1.
async function createSampleDrafts(workspaceId) {
  const creatorEmail = DEMO_USERS.find((u) => u.role === 'creator').email;
  const creator = await User.findOne({ workspaceId, email: creatorEmail });
  if (!creator) return 0;

  // Created in reverse so "Summer launch post" is the newest and tops the list
  // (the draft list is sorted by last activity).
  for (const sample of [...SAMPLE_DRAFTS].reverse()) {
    const draft = await Draft.create({
      workspaceId,
      title: sample.title,
      contentType: sample.contentType,
      createdBy: creator._id,
      status: 'draft',
      currentVersion: 1,
    });
    await DraftVersion.create({
      draftId: draft._id,
      version: 1,
      text: sample.text,
      createdBy: creator._id,
      note: 'Initial version',
    });
  }
  return SAMPLE_DRAFTS.length;
}

// Wipe this workspace's data and load the FreshNest knowledge base and sample
// drafts again. Also used by POST /api/demo/reset. Users are NOT touched.
export async function reseedWorkspace(workspace) {
  const workspaceId = workspace._id;

  await wipeDrafts(workspaceId);
  await Promise.all([
    Clause.deleteMany({ workspaceId }),
    Fact.deleteMany({ workspaceId }),
    Term.deleteMany({ workspaceId }),
  ]);
  await Workspace.updateOne({ _id: workspaceId }, { $set: { aiEnabled: WORKSPACE.aiEnabled } });

  const withWorkspace = (rows) => rows.map((row) => ({ ...row, workspaceId }));
  const [clauses, facts, terms] = await Promise.all([
    Clause.insertMany(withWorkspace(CLAUSES)),
    Fact.insertMany(withWorkspace(FACTS)),
    Term.insertMany(withWorkspace(TERMS)),
  ]);
  const drafts = await createSampleDrafts(workspaceId);
  return { clauses: clauses.length, facts: facts.length, terms: terms.length, drafts };
}

async function runCli() {
  if (!config.mongoUri) {
    console.error('MONGODB_URI is not set. Fill in server/.env first.');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  // Make sure unique indexes exist before inserting (they are built in the background).
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const workspace = await ensureWorkspaceAndUsers();
  const counts = await reseedWorkspace(workspace);

  console.log(`Workspace "${workspace.name}" reset and reseeded:`);
  console.log(
    `  ${DEMO_USERS.length} demo users, ${counts.clauses} clauses, ${counts.facts} facts, ${counts.terms} terms, ${counts.drafts} sample drafts`
  );
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

// Run only when started as a script (npm run seed), not when imported by routes/demo.js.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(async (err) => {
    console.error('Seed failed:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
