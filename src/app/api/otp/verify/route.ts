import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isCollegeEmail, verifyOtpCookie } from "@/lib/otp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; otp?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const otp = body.otp?.trim() ?? "";

  if (!isCollegeEmail(email) || !/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { error: "Enter the six-digit code sent to your .edu email." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const isVerified = verifyOtpCookie(
    cookieStore.get("bites_otp")?.value,
    email,
    otp,
  );

  if (!isVerified) {
    return NextResponse.json(
      { error: "That code is invalid or expired." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("bites_otp");

  return response;
}
