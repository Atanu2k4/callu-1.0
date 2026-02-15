import { NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import LoginOtp from "@/models/LoginOtp";
import { sendNotifyMail } from "@/lib/notifyMail";

const hashValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const makeCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.status !== "approved") {
      return NextResponse.json({ message: "Your application is still pending review." }, { status: 403 });
    }

    const code = makeCode();
    const codeHash = hashValue(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await LoginOtp.findOneAndUpdate(
      { email },
      { codeHash, expiresAt },
      { upsert: true, new: true }
    );

    const subject = "Your CALLU verification code";
    const text = `Your CALLU verification code is ${code}. It expires in 10 minutes.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#09090b; color:#ffffff; padding:32px;">
        <div style="max-width:520px;margin:0 auto;background:#18181b;border-radius:16px;padding:28px;border:1px solid #27272a;">
          <h1 style="margin:0 0 12px;font-size:22px;">CALLU verification</h1>
          <p style="margin:0 0 18px;color:#a1a1aa;">Use this code to sign in. It expires in 10 minutes.</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#0f172a;border:1px solid #1f2937;border-radius:12px;padding:14px;text-align:center;">
            ${code}
          </div>
          <p style="margin:16px 0 0;color:#71717a;font-size:12px;">If you didn’t request this, you can ignore this email.</p>
        </div>
      </div>
    `;

    await sendNotifyMail({ to: email, subject, text, html });

    return NextResponse.json({ message: "Verification code sent" }, { status: 200 });
  } catch (error: any) {
    console.error("OTP send error:", error);
    return NextResponse.json({ message: error?.message || "Failed to send code" }, { status: 500 });
  }
}
