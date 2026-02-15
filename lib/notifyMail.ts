import { Resend } from "resend";

export type NotifyMailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const sendNotifyMail = async ({ to, subject, text, html }: NotifyMailParams) => {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("Email service is not configured");
  }

  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to,
    subject,
    text,
    html,
  });
};
