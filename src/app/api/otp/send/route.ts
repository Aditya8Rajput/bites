import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createOtp, createOtpCookie, isCollegeEmail } from "@/lib/otp";

export const runtime = "nodejs";

async function sendOtpEmail(email: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OTP_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: "Your Bites verification code",
      text: `Your Bites verification code is ${otp}. It expires in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    throw new Error("OTP email could not be sent.");
  }

  return true;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!isCollegeEmail(email)) {
    return NextResponse.json(
      { error: "Use your official .edu college email." },
      { status: 400 },
    );
  }

  const otp = createOtp();
  const otpCookie = createOtpCookie(email, otp);
  const emailSent = await sendOtpEmail(email, otp);
  const response = NextResponse.json({
    ok: true,
    delivery: emailSent ? "email" : "development",
    devOtp: emailSent ? undefined : otp,
  });

  const cookieStore = await cookies();
  cookieStore.set("bites_otp", otpCookie.value, {
    httpOnly: true,
    maxAge: otpCookie.maxAge,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
