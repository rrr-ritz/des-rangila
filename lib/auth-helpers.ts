import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Volunteer } from "@/lib/types";

export type AuthRole = "public" | "volunteer" | "admin";

interface AuthResult {
  uid: string;
  volunteer: Volunteer | null;
}

/**
 * Verify Firebase auth token from Authorization header and check role.
 * Returns the decoded UID and volunteer record, or throws.
 */
export async function verifyAuth(
  request: NextRequest,
  requiredRole: AuthRole
): Promise<AuthResult> {
  if (requiredRole === "public") {
    return { uid: "", volunteer: null };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    throw new AuthError("Unauthorized", 401);
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const uid = decoded.uid;

  // Look up volunteer record by UID
  const snapshot = await adminDb
    .collection("volunteers")
    .where("uid", "==", uid)
    .limit(1)
    .get();

  const volunteer = snapshot.empty
    ? null
    : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Volunteer);

  if (requiredRole === "admin") {
    // Check volunteer record first, then fall back to ADMIN_EMAILS env var
    const isAdminVolunteer = volunteer?.role === "admin";
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdminEmail =
      decoded.email && adminEmails.includes(decoded.email.toLowerCase());

    if (!isAdminVolunteer && !isAdminEmail) {
      throw new AuthError("Forbidden", 403);
    }
  }

  if (requiredRole === "volunteer" && !volunteer) {
    throw new AuthError("Forbidden", 403);
  }

  return { uid, volunteer };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
