import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth, AuthError } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const doc = await adminDb.collection("settings").doc("auditLog").get();
  const enabled = doc.exists ? doc.data()?.enabled === true : false;

  return NextResponse.json({ enabled });
}

export async function PATCH(request: NextRequest) {
  try {
    await verifyAuth(request, "admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const body = await request.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled (boolean) is required" },
      { status: 400 }
    );
  }

  await adminDb.collection("settings").doc("auditLog").set({ enabled }, { merge: true });

  return NextResponse.json({ success: true, enabled });
}
