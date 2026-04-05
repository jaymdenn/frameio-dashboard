import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Initiates OAuth flow with Adobe IMS for Frame.io V4 API
 * Redirects user to Adobe login
 */
export async function GET() {
  const clientId = process.env.FRAMEIO_OAUTH_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in cookie for verification
  const cookieStore = await cookies();
  cookieStore.set("frameio_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  // Adobe IMS OAuth authorize endpoint
  // Required scopes for Frame.io V4
  const scopes = [
    "openid",
    "offline_access",
    "email",
    "profile",
    "additional_info.roles",
  ].join(" ");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://frameio-dashboard.vercel.app"}/api/auth/callback`;

  const authUrl = new URL("https://ims-na1.adobelogin.com/ims/authorize/v2");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
