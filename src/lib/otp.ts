import { createHmac, randomInt, timingSafeEqual } from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;

type OtpPayload = {
  email: string;
  expiresAt: number;
  otpHash: string;
};

function getOtpSecret() {
  return process.env.OTP_SECRET ?? "bites-local-otp-secret";
}

function sign(value: string) {
  return createHmac("sha256", getOtpSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createOtp() {
  return randomInt(100000, 1000000).toString();
}

export function isCollegeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.edu$/i.test(email.trim());
}

export function createOtpCookie(email: string, otp: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + OTP_TTL_MS;
  const payload: OtpPayload = {
    email: normalizedEmail,
    expiresAt,
    otpHash: sign(`${normalizedEmail}:${otp}:${expiresAt}`),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = sign(encodedPayload);

  return {
    maxAge: OTP_TTL_MS / 1000,
    value: `${encodedPayload}.${signature}`,
  };
}

export function verifyOtpCookie(
  cookieValue: string | undefined,
  email: string,
  otp: string,
) {
  if (!cookieValue) {
    return false;
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    return false;
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as OtpPayload;
  const normalizedEmail = email.trim().toLowerCase();

  if (payload.email !== normalizedEmail || Date.now() > payload.expiresAt) {
    return false;
  }

  return safeEqual(
    payload.otpHash,
    sign(`${normalizedEmail}:${otp}:${payload.expiresAt}`),
  );
}
