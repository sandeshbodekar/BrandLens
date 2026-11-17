import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { Clause } from '../models/Clause.js';
import { Fact } from '../models/Fact.js';
import { Term } from '../models/Term.js';
import { WORKSPACE, DEMO_PASSWORD, DEMO_USERS, CLAUSES, FACTS, TERMS } from './brandData.js';

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

// Wipe this workspace's data and load the FreshNest knowledge base again.
// Also used by POST /api/demo/reset. Users are NOT touched.
// Phase 3 and later: add Draft, DraftVersion, Finding, Comment, Review and
// AuditLog to the wipe below.
export async function reseedWorkspace(workspace) {
  const workspaceId = workspace._id;

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
  return { clauses: clauses.length, facts: facts.length, terms: terms.length };
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
  console.log(`  ${DEMO_USERS.length} demo users, ${counts.clauses} clauses, ${counts.facts} facts, ${counts.terms} terms`);
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
