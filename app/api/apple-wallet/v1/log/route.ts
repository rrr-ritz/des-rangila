import { NextRequest, NextResponse } from "next/server";

/**
 * Apple Wallet Web Service - Log Errors
 *
 * POST /api/apple-wallet/v1/log
 *   Apple sends error logs from devices when pass updates fail.
 *   We log them server-side for debugging.
 *
 * See: https://developer.apple.com/documentation/walletpasses/log_a_message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const logs = body.logs || [];

    if (logs.length > 0) {
      console.warn("Apple Wallet device logs:", JSON.stringify(logs, null, 2));
    }

    // Always return 200
    return new NextResponse(null, { status: 200 });
  } catch {
    // Even on parse error, return 200 to Apple
    return new NextResponse(null, { status: 200 });
  }
}
