// import dotenv from 'dotenv';
// dotenv.config();
// import nodemailer from "nodemailer";
// const smtpUser = process.env.SMTP_USER;
// const smtpPass = process.env.SMTP_PASS;
// const smtpHost = process.env.SMTP_HOST; // e.g. smtp.mailtrap.io or smtp.gmail.com
// const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined; // e.g. 587
// const smtpSecure = process.env.SMTP_SECURE === 'true'; // 'true' when using port 465
// const smtpService = process.env.SMTP_SERVICE; // optional well-known service name like 'gmail'

// // Build transporter options explicitly so Nodemailer doesn't default to localhost:587
// let transporterOptions = {};
// if (smtpHost) {
//   transporterOptions = {
//     host: smtpHost,
//     port: smtpPort || 587,
//     secure: !!smtpSecure,
//     auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
//   };
// } else if (smtpService) {
//   transporterOptions = {
//     service: smtpService,
//     auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
//   };
// } else {
//   // No SMTP configured. To avoid Nodemailer attempting network connections (and causing ETIMEDOUT),
//   // use a safe stream transport in development which keeps messages in-memory (no network).
//   // In production you should set SMTP_HOST/SMTP_PORT/SMTP_SECURE or SMTP_SERVICE.
//   transporterOptions = {
//     streamTransport: true,
//     newline: 'unix',
//     buffer: true,
//   };
//   console.warn('No SMTP_HOST or SMTP_SERVICE configured. Using in-memory stream transport (dev only).\nSet SMTP_HOST/SMTP_PORT/SMTP_SECURE or SMTP_SERVICE for real delivery.');
// }

// // create nodemailer transporter for sending emails as per the SMTP configuration.
// const transporter = nodemailer.createTransport(transporterOptions);


// // verify transporter configuration (optional, run once on startup) and log success or error
// transporter.verify((error, success) => {
//   if (error) {
//     console.error("Email transporter verification failed:", error);
//   } else {
//     console.log("Email transporter is ready"); 
//   }
// });

// async function sendEmail(to, subject, html) {
//   try {
//     const mailOptions = {
//       from: `"Your App Name" <${process.env.SMTP_USER}>`,
//       to,
//       subject,
//       html,
//     };
//     const info = await transporter.sendMail(mailOptions);
//     console.log(`Email sent: ${info.messageId}`);
//     return info;
//   } catch (error) {
//     console.error("Error sending email: ", error);
//     throw error;
//   }
// }

// // for sending verification email
// export async function sendVerificationEmail(to, otp) {
//   const subject = "Your Email Verification OTP";
//   const htmlContent = `
//     <h3>Please verify your email</h3>
//     <p>Your OTP code is:</p>
//     <h2>${otp}</h2>
//     <p>This code expires in 10 minutes.</p>
//   `;
//   return sendEmail(to, subject, htmlContent);
// }

// // for sending forgot password email
// export async function sendForgotPasswordEmail(to, resetLink) {
//   const subject = "Password Reset Request";
//   const htmlContent = `
//     <p>You requested a password reset. Click the link below to reset your password:</p>
//     <a href="${resetLink}">${resetLink}</a>
//     <p>If you didn't request this, please ignore this email.</p>
//   `;
//   return sendEmail(to, subject, htmlContent);
// }
