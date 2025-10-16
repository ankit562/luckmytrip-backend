import dotenv from 'dotenv';
dotenv.config();
import nodemailer from "nodemailer";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

// create nodemailer transporter for sending emails as per the SMTP configuration.

const transporter = nodemailer.createTransport({
  service: "gmail", // or use 'smtp.gmail.com' with host and port
  auth: {
    user: smtpUser, 
    pass: smtpPass,
  },
});


// verify transporter configuration (optional, run once on startup) and log success or error
transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter verification failed:", error);
  } else {
    console.log("Email transporter is ready"); 
  }
});

async function sendEmail(to, subject, html) {
  try {
    const mailOptions = {
      from: `"Your App Name" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending email: ", error);
    throw error;
  }
}

// for sending verification email
export async function sendVerificationEmail(to, otp) {
  const subject = "Your Email Verification OTP";
  const htmlContent = `
    <h3>Please verify your email</h3>
    <p>Your OTP code is:</p>
    <h2>${otp}</h2>
    <p>This code expires in 10 minutes.</p>
  `;
  return sendEmail(to, subject, htmlContent);
}

// for sending forgot password email
export async function sendForgotPasswordEmail(to, resetLink) {
  const subject = "Password Reset Request";
  const htmlContent = `
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  return sendEmail(to, subject, htmlContent);
}
