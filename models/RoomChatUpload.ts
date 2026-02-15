import mongoose, { Schema, model, models } from "mongoose";

const RoomChatUploadSchema = new Schema(
  {
    roomId: { type: String, required: true, index: true },
    key: { type: String, required: true, unique: true },
    provider: { type: String, required: true, default: "imagekit" },
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number },
    uploadedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default models.RoomChatUpload || model("RoomChatUpload", RoomChatUploadSchema);
