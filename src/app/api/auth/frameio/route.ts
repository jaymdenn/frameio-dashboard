import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Initiates OAuth flow with Frame.io Developer Portal
 * Uses Frame.io's own OAuth endpoints (not Adobe IMS)
 * @see https://developer.frame.io/docs/oauth-2-applications/oauth-2-code-authorization-flow
 */
export async function GET() {
  const clientId = process.env.FRAMEIO_OAUTH_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "OAuth not configured. Set FRAMEIO_OAUTH_CLIENT_ID in environment variables." },
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

  // Frame.io OAuth scopes - space delimited
  // offline = required for refresh_token
  // account.read = read account info
  // team.read = read teams (required for listing teams/workspaces)
  // project.read = read projects (required for listing projects)
  // asset.read = read assets (folders, files)
  // asset.create = create assets (upload files)
  const scopes = "offline account.read team.read project.read asset.read asset.create";

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://frameio-dashboard.vercel.app"}/api/auth/callback`;

  // Frame.io's own OAuth authorize endpoint
  const authUrl = new URL("https://applications.frame.io/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
