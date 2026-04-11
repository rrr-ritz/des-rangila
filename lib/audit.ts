import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import type { AuditAction, AuditSeverity, Role } from "@/lib/types";

interface LogActionParams {
  action: AuditAction | string;
  actorId: string;
  actorName: string;
  actorRole: Role | "system";
  targetId?: string | null;
  targetType?: string | null;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
  notifyAdmins?: boolean;
}

/**
 * Append an entry to the audit_log collection.
 * This is append-only — entries are never updated or deleted.
 */
export async function logAction({
  action,
  actorId,
  actorName,
  actorRole,
  targetId = null,
  targetType = null,
  details = {},
  severity = "info",
  notifyAdmins = false,
}: LogActionParams): Promise<string> {
  // Check if audit logging is enabled
  try {
    const settingsDoc = await adminDb.collection("settings").doc("auditLog").get();
    if (settingsDoc.exists && settingsDoc.data()?.enabled === false) {
      return "";
    }
  } catch {
    // If we can't check settings, log anyway
  }

  const ref = adminDb.collection("audit_log").doc();
  await ref.set({
    id: ref.id,
    action,
    actorId,
    actorName,
    actorRole,
    targetId,
    targetType,
    details,
    severity,
    timestamp: Timestamp.now(),
    notifyAdmins,
  });
  return ref.id;
}
