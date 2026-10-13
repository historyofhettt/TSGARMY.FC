import { Resend } from "resend";
import { env } from "./env";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!env.resendApiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }

  return resendClient;
}

export async function sendOtpEmail(to: string, otp: string) {
  const client = getResendClient();
  if (!client) {
    const error = "Resend client not initialized: missing RESEND_API_KEY";
    console.error("[email]", error);
    throw new Error(error);
  }

  const from = env.emailFrom || "TSG <onboarding@resend.dev>";

  try {
    const result = await client.emails.send({
      from,
      to,
      subject: "Your TSG verification code",
      text: `Your TSG verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
      html: `<p>Your TSG verification code is:</p><h2 style="letter-spacing:4px;">${otp}</h2><p>This code expires in 10 minutes.</p>`,
    });

    if (result.error) {
      const errorMessage = result.error.message || "Resend returned an error";
      console.error("[email] Resend OTP send failed", {
        emailId: (result.data as any)?.id ?? null,
        errorName: result.error.name ?? null,
        errorMessage: result.error.message ?? null,
        statusCode: (result.error as any).statusCode ?? null,
      });
      throw new Error(`Failed to send OTP email: ${errorMessage}`);
    }

    console.log("[email] Resend OTP accepted", { emailId: (result.data as any)?.id ?? null });

    return {
      success: true,
      emailId: result.data?.id || null,
      message: "OTP email sent via Resend",
    };
  } catch (error: any) {
    console.error("[email] Resend OTP send failed", {
      to,
      error: error.message || "Unknown error",
      statusCode: error.statusCode ?? null,
    });
    throw new Error(`Failed to send OTP email: ${error.message || "Unknown error"}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const client = getResendClient();
  if (!client) {
    const error = "Resend client not initialized: missing RESEND_API_KEY";
    console.error("[email]", error);
    throw new Error(error);
  }

  const from = env.emailFrom || "TSG <onboarding@resend.dev>";

  try {
    const result = await client.emails.send({
      from,
      to,
      subject: "Reset your TSG password",
      text: `Reset your password by visiting: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Reset your password by clicking the link below:</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1e63ff;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });

    if (result.error) {
      const errorMessage = result.error.message || "Resend returned an error";
      console.error("[email] Resend password reset send failed", {
        emailId: (result.data as any)?.id ?? null,
        errorName: result.error.name ?? null,
        errorMessage: result.error.message ?? null,
        statusCode: (result.error as any).statusCode ?? null,
      });
      throw new Error(`Failed to send password reset email: ${errorMessage}`);
    }

    console.log("[email] Resend password reset accepted", { emailId: (result.data as any)?.id ?? null });

    return {
      success: true,
      emailId: result.data?.id || null,
      message: "Password reset email sent via Resend",
    };
  } catch (error: any) {
    console.error("[email] Resend password reset send failed", {
      to,
      error: error.message || "Unknown error",
      statusCode: error.statusCode ?? null,
    });
    throw new Error(`Failed to send password reset email: ${error.message || "Unknown error"}`);
  }
}