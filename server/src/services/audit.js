import { AuditLog } from '../models/AuditLog.js';

// Writes one audit row. It NEVER throws: a failed log line must not make the real
// action (submit, approve...) fail after it already succeeded.
export async function logAudit({ workspaceId, actorId, action, entity = 'Draft', entityId, meta = {} }) {
  try {
    await AuditLog.create({ workspaceId, actorId, action, entity, entityId, meta });
  } catch (err) {
    console.warn(`[audit] could not write "${action}": ${err.message}`);
  }
}
