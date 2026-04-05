import { NextResponse } from "next/server";

/**
 * Debug endpoint to check OAuth configuration
 */
export async function GET() {
  const clientId = process.env.FRAMEIO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FRAMEIO_OAUTH_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://frameio-dashboard.vercel.app"}/api/auth/callback`;

  const scopes = "offline account.read team.read project.read asset.read asset.create";

  const authUrl = new URL("https://applications.frame.io/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId || "NOT_SET");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", "debug_state");

  return NextResponse.json({
    clientIdSet: !!clientId,
    clientIdLength: clientId?.length || 0,
    clientIdPreview: clientId ? `${clientId.slice(0, 8)}...${clientId.slice(-4)}` : "NOT_SET",
    clientSecretSet: !!clientSecret,
    redirectUri,
    authUrl: authUrl.toString(),
  });
}
