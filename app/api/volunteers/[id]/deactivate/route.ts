import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";
import { logAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let authResult;
  try {
    authResult = await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const body = await request.json();
  const { isActive } = body;

  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "isActive (boolean) is required" },
      { status: 400 }
    );
  }

  const ref = adminDb.collection("volunteers").doc(params.id);
  const doc = await ref.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Volunteer not found" }, { status: 404 });
  }

  await ref.update({ isActive });

  const data = doc.data()!;
  await logAction({
    action: isActive ? "volunteer.reactivated" : "volunteer.deactivated",
    actorId: authResult.uid,
    actorName: authResult.volunteer?.name || "Admin",
    actorRole: "admin",
    targetId: params.id,
    targetType: "volunteer",
    details: { volunteerName: data.name },
    severity: "warning",
    notifyAdmins: true,
  });

  return NextResponse.json({ success: true, isActive });
}
