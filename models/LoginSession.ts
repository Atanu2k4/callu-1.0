import { Schema, model, models } from "mongoose";

const LoginSessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default models.LoginSession || model("LoginSession", LoginSessionSchema);
