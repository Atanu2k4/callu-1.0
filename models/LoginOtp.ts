import { Schema, model, models } from "mongoose";

const LoginOtpSchema = new Schema(
  {
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default models.LoginOtp || model("LoginOtp", LoginOtpSchema);
