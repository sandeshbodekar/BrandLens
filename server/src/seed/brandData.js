// Seed data for the fictional brand (SRS 11). Phase 1 holds only the workspace
// and the demo users. Phase 2 adds clauses, facts, terms and sample drafts here.

export const WORKSPACE = {
  name: 'FreshNest Organic Foods',
  description: 'Fictional brand used for the BrandLens demo.',
  aiEnabled: true,
};

export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_USERS = [
  { name: 'Demo Admin', email: 'admin@freshnest.demo', role: 'admin' },
  { name: 'Demo Creator', email: 'creator@freshnest.demo', role: 'creator' },
  { name: 'Demo Reviewer', email: 'reviewer@freshnest.demo', role: 'reviewer' },
];
