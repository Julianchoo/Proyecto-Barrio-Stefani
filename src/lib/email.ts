import nodemailer from "nodemailer";

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transport.sendMail({
    from: `"Barrio Stefani CRM" <${process.env.GMAIL_USER}>`,
    ...options,
  });
}
