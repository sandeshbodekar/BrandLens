import mongoose from 'mongoose';

// SRS 5: Workspace { name, description, aiEnabled (default true) }
const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    aiEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Workspace = mongoose.model('Workspace', workspaceSchema);
