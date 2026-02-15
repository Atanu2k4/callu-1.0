import { NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import LoginSession from "@/models/LoginSession";
import User from "@/models/User";

const hashValue = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ message: "Token required" }, { status: 400 });
    }

    await dbConnect();
    const tokenHash = hashValue(token);
    const session = await LoginSession.findOne({ tokenHash });

    if (!session) {
      return NextResponse.json({ message: "Session not found" }, { status: 401 });
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await LoginSession.deleteOne({ _id: session._id });
      return NextResponse.json({ message: "Session expired" }, { status: 401 });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user, expiresAt: session.expiresAt }, { status: 200 });
  } catch (error: any) {
    console.error("Session check error:", error);
    return NextResponse.json({ message: error?.message || "Session check failed" }, { status: 500 });
  }
}
