import mongoose from 'mongoose';
import { config } from '../config.js';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { WORKSPACE, DEMO_PASSWORD, DEMO_USERS } from './brandData.js';

// Minimal Phase 1 seed: one workspace + the three demo users.
// Safe to run repeatedly: it upserts, so it never creates duplicates.
// Phase 2 extends this file with the full FreshNest data and demo reset.
async function seed() {
  if (!config.mongoUri) {
    console.error('MONGODB_URI is not set. Fill in server/.env first.');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });

  const workspace = await Workspace.findOneAndUpdate(
    { name: WORKSPACE.name },
    { $setOnInsert: { description: WORKSPACE.description, aiEnabled: WORKSPACE.aiEnabled } },
    { upsert: true, new: true }
  );

  // One hash is reused for all three users (each login still verifies normally).
  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  for (const u of DEMO_USERS) {
    await User.findOneAndUpdate(
      { email: u.email },
      { $set: { name: u.name, role: u.role, workspaceId: workspace._id, passwordHash } },
      { upsert: true, new: true }
    );
  }

  console.log(`Seeded workspace "${workspace.name}" and ${DEMO_USERS.length} demo users.`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
