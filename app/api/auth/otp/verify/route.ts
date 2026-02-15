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
    const otp = await LoginOtp.findOne({ email });
    
    if (!otp) {
      console.error(`[OTP_VERIFY] ✗ No OTP found in DB for ${email}`);
      console.error(`[OTP_VERIFY] Searching all OTPs for debugging...`);
      const allOtps = await LoginOtp.find({}).lean();
      console.error(`[OTP_VERIFY] Total OTPs in DB: ${allOtps.length}`);
      allOtps.forEach((o: any) => console.error(`[OTP_VERIFY]   - ${o.email} (expires: ${o.expiresAt})`));
      
      return NextResponse.json({ message: "Code expired. Request a new one." }, { status: 401 });
    }

    console.log(`[OTP_VERIFY] ✓ Found OTP record for ${email}`);
    console.log(`[OTP_VERIFY] OTP expiry: ${otp.expiresAt.toISOString()}, now: ${new Date().toISOString()}`);

    if (otp.expiresAt.getTime() < Date.now()) {
      console.warn(`[OTP_VERIFY] ✗ OTP expired for ${email}`);
      await LoginOtp.deleteOne({ _id: otp._id });
      return NextResponse.json({ message: "Code expired. Request a new one." }, { status: 401 });
    }

    console.log(`[OTP_VERIFY] ✓ OTP not expired`);

    const incomingCodeStr = code.toString().trim();
    const codeHash = hashValue(incomingCodeStr);
    
    console.log(`[OTP_VERIFY] Comparing hashes:`);
    console.log(`[OTP_VERIFY]   Incoming code: "${incomingCodeStr}" (length: ${incomingCodeStr.length})`);
    console.log(`[OTP_VERIFY]   Computed hash: ${codeHash.substring(0, 32)}...`);
    console.log(`[OTP_VERIFY]   Stored hash:   ${otp.codeHash.substring(0, 32)}...`);
    console.log(`[OTP_VERIFY]   Match: ${codeHash === otp.codeHash}`);

    if (codeHash !== otp.codeHash) {
      console.error(`[OTP_VERIFY] ✗ Code hash mismatch for ${email}`);
      return NextResponse.json({ message: "Invalid verification code" }, { status: 401 });
    }

    console.log(`[OTP_VERIFY] ✓ Code hash matches`);

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`[OTP_VERIFY] ✗ User not found for ${email}`);
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    console.log(`[OTP_VERIFY] ✓ User found: ${user.email}, status: ${user.status}`);

    if (user.status !== "approved") {
      console.warn(`[OTP_VERIFY] ✗ User not approved: ${email}, status: ${user.status}`);
      return NextResponse.json({ message: "Your application is still pending review." }, { status: 403 });
    }

    console.log(`[OTP_VERIFY] ✓ User approved`);

    const sessionToken = makeToken();
    const tokenHash = hashValue(sessionToken);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

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
