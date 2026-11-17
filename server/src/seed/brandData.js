// Seed data for the fictional brand FreshNest Organic Foods (SRS 11).
// Sample drafts are added in a later phase, once drafts exist.

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

export const CLAUSES = [
  {
    code: 'C-4.2',
    category: 'claims',
    title: 'Superlative claims need proof',
    text: 'Words like best, #1, healthiest, or 100% may be used only when an approved fact supports them.',
    severityDefault: 'high',
  },
  {
    code: 'C-5.1',
    category: 'legal',
    title: 'No health or medical claims',
    text: 'Never claim that a product cures, treats, prevents or boosts any health condition, including immunity.',
    severityDefault: 'high',
  },
  {
    code: 'C-6.1',
    category: 'legal',
    title: 'Offers need exact end dates',
    text: 'Any offer must state an exact end date, not a month or "limited time".',
    severityDefault: 'medium',
  },
  {
    code: 'V-2',
    category: 'tone',
    title: 'Friendly, not pushy',
    text: 'Use a warm, friendly voice. Avoid urgency phrases such as "buy now" or "hurry".',
    severityDefault: 'low',
  },
  {
    code: 'T-1',
    category: 'terminology',
    title: 'Preferred product terms',
    text: 'Call our products "cold-pressed juice". Do not use the words detox or miracle.',
    severityDefault: 'medium',
  },
  {
    code: 'C-7.1',
    category: 'claims',
    title: 'Ingredient accuracy',
    text: 'Ingredient and nutrition statements must match the approved facts exactly.',
    severityDefault: 'high',
  },
];

export const FACTS = [
  {
    code: 'F-12',
    statement: 'Our juices contain no added sugar. They contain natural fruit sugar.',
    currentText: 'no added sugar',
    staleVariants: [],
    validFrom: new Date('2026-01-01'),
    validTo: null,
  },
  {
    code: 'F-15',
    statement: 'Our juices are cold-pressed in small batches in Pune.',
    currentText: '',
    staleVariants: [],
    validFrom: new Date('2026-01-01'),
    validTo: null,
  },
  {
    code: 'F-20',
    statement: 'The price of a 300 ml bottle is Rs 109.',
    currentText: 'Rs 109',
    staleVariants: ['Rs 99', 'Rs. 99', '₹99'],
    validFrom: new Date('2026-10-01'),
    validTo: null,
  },
  {
    code: 'F-21',
    statement: 'Juices have a shelf life of 5 days when refrigerated.',
    currentText: '',
    staleVariants: [],
    validFrom: new Date('2026-01-01'),
    validTo: null,
  },
];

export const TERMS = [
  {
    preferred: 'cold-pressed juice',
    banned: ['detox', 'miracle', 'cure'],
    clauseCode: 'T-1',
    note: '',
  },
];
