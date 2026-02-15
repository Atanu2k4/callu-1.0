import { NextResponse } from "next/server";
import ImageKit from "imagekit";
import dbConnect from "@/lib/db";
import RoomChatUpload from "@/models/RoomChatUpload";

export const runtime = "nodejs";

const getImageKit = () => {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("Missing ImageKit configuration in environment variables");
  }

  return new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });
};

const sanitizeFileName = (name: string) => name.replace(/[^\w.\-]+/g, "_");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const roomId = formData.get("roomId")?.toString();
    const userId = formData.get("userId")?.toString();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (!roomId || files.length === 0) {
      return NextResponse.json({ message: "Missing roomId or files" }, { status: 400 });
    }

    const imagekit = getImageKit();
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 60 * 1000);

    await dbConnect();

    const attachments = [] as Array<{
      key: string;
      url: string;
      name: string;
      type: string;
      size: number;
      expiresAt: string;
    }>;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = sanitizeFileName(file.name || "file");

      const uploadResult = await imagekit.upload({
        file: buffer,
        fileName: safeName,
        folder: `rooms/${roomId}/chat`,
        useUniqueFileName: true,
      });

      const fileId = uploadResult.fileId;
      const url = uploadResult.url;

      await RoomChatUpload.create({
        roomId,
        key: fileId,
        provider: "imagekit",
        fileId,
        url,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        uploadedBy: userId,
        expiresAt,
      });

      attachments.push({
        key: fileId,
        url,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return NextResponse.json({ attachments });
  } catch (error: any) {
    const message = error?.message || error?.name || "Upload failed";
    console.error("Chat upload error:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
