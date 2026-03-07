import { NextRequest, NextResponse } from "next/server";
import { generateQrBuffer } from "@/lib/qr";

export async function GET(
  _request: NextRequest,
  { params }: { params: { payload: string } }
) {
  try {
    const buffer = await generateQrBuffer(params.payload);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
