import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback handler for Adobe IMS / Frame.io V4
 * Exchanges authorization code for access token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/admin/folders?error=${encodeURIComponent(errorDescription || error)}`,
        request.url
      )
    );
  }

  // Verify state for CSRF protection
  const cookieStore = await cookies();
  const storedState = cookieStore.get("frameio_oauth_state")?.value;

  if (!state || state !== storedState) {
    console.error("OAuth state mismatch");
    return NextResponse.redirect(
      new URL("/admin/folders?error=Invalid+state", request.url)
    );
  }

  // Clear the state cookie
  cookieStore.delete("frameio_oauth_state");

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/folders?error=No+authorization+code", request.url)
    );
  }

  const clientId = process.env.FRAMEIO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FRAMEIO_OAUTH_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://frameio-dashboard.vercel.app"}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/admin/folders?error=OAuth+not+configured", request.url)
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://ims-na1.adobelogin.com/ims/token/v3",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange error:", errorText);
      return NextResponse.redirect(
        new URL(
          `/admin/folders?error=${encodeURIComponent("Token exchange failed")}`,
          request.url
        )
      );
    }

    const tokenData = await tokenResponse.json();

    // Store the tokens in Supabase settings table
    const supabase = await createClient();

    // Store access token
    await supabase.from("settings").upsert(
      {
        key: "frameio_access_token",
        value: tokenData.access_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // Store refresh token if provided
    if (tokenData.refresh_token) {
      await supabase.from("settings").upsert(
        {
          key: "frameio_refresh_token",
          value: tokenData.refresh_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    // Store token expiry
    if (tokenData.expires_in) {
      const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString();
      await supabase.from("settings").upsert(
        {
          key: "frameio_token_expires_at",
          value: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    console.log("Frame.io OAuth tokens stored successfully");

    // Redirect back to folders page with success message
    return NextResponse.redirect(
      new URL("/admin/folders?connected=true", request.url)
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/admin/folders?error=${encodeURIComponent("Authentication failed")}`,
        request.url
      )
    );
  }
}
