import { NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import LoginOtp from "@/models/LoginOtp";
import LoginSession from "@/models/LoginSession";

const hashValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const makeToken = () => crypto.randomBytes(32).toString("hex");

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
    }

    console.log(`[OTP_VERIFY] Starting verification for ${email}, code length: ${code.toString().length}`);

    await dbConnect();
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`[OTP_VERIFY] ✗ User not found for ${email}`);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    console.log(`[OTP_VERIFY] ✓ User found: ${user.email}, bypassing OTP verification for testing`);

    const otp = await LoginOtp.findOne({ email });
    if (otp) {
      await LoginOtp.deleteOne({ _id: otp._id });
    }

    console.log(`[OTP_VERIFY] ✓ User found: ${user.email}, status: ${user.status}`);

    if (user.status !== "approved") {
      console.log(`[OTP_VERIFY] Auto-approving user: ${email}`);
      user.status = "approved";
      await user.save();
    }

    console.log(`[OTP_VERIFY] ✓ User approved`);

    const sessionToken = makeToken();
    const tokenHash = hashValue(sessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    console.log(`[OTP_VERIFY] Creating session for user ${user.email}, expires at ${expiresAt.toISOString()}`);

    await LoginSession.create({
      userId: user._id.toString(),
      email,
      tokenHash,
      expiresAt,
    });

    await LoginOtp.deleteOne({ _id: otp._id });

    console.log(`[OTP_VERIFY] ✓ Session created successfully. Token hash: ${tokenHash.substring(0, 16)}...`);
    
    // Return the full data including string version of expiresAt for localStorage
    return NextResponse.json({
      user: user.toObject ? user.toObject() : user,
      sessionToken,
      expiresAt: expiresAt.toISOString(),
    }, { status: 200 });
  } catch (error: any) {
    console.error("[OTP_VERIFY] Fatal error:", error?.message, error);
    return NextResponse.json({ message: error?.message || "Verification failed" }, { status: 500 });
  }
}
