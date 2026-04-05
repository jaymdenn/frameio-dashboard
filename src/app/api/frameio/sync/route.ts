import { NextResponse } from "next/server";
import { createFrameioClient } from "@/lib/frameio";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try to get OAuth token from settings first
    const { data: tokenSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "frameio_access_token")
      .single();

    let frameioToken = tokenSetting?.value || process.env.FRAMEIO_API_TOKEN;

    // Check if OAuth token is expired and refresh if needed
    if (tokenSetting?.value) {
      const { data: expirySetting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "frameio_token_expires_at")
        .single();

      if (expirySetting?.value) {
        const expiresAt = new Date(expirySetting.value);
        const now = new Date();

        // If token expires in less than 5 minutes, refresh it
        if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
          const { data: refreshSetting } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "frameio_refresh_token")
            .single();

          if (refreshSetting?.value) {
            try {
              const refreshResponse = await fetch(
                "https://ims-na1.adobelogin.com/ims/token/v3",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({
                    grant_type: "refresh_token",
                    client_id: process.env.FRAMEIO_OAUTH_CLIENT_ID || "",
                    client_secret: process.env.FRAMEIO_OAUTH_CLIENT_SECRET || "",
                    refresh_token: refreshSetting.value,
                  }),
                }
              );

              if (refreshResponse.ok) {
                const newTokenData = await refreshResponse.json();
                frameioToken = newTokenData.access_token;

                // Update stored tokens
                await supabase.from("settings").upsert(
                  {
                    key: "frameio_access_token",
                    value: newTokenData.access_token,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "key" }
                );

                if (newTokenData.refresh_token) {
                  await supabase.from("settings").upsert(
                    {
                      key: "frameio_refresh_token",
                      value: newTokenData.refresh_token,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "key" }
                  );
                }

                if (newTokenData.expires_in) {
                  const newExpiresAt = new Date(
                    Date.now() + newTokenData.expires_in * 1000
                  ).toISOString();
                  await supabase.from("settings").upsert(
                    {
                      key: "frameio_token_expires_at",
                      value: newExpiresAt,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "key" }
                  );
                }
              }
            } catch (refreshError) {
              console.error("Token refresh failed:", refreshError);
            }
          }
        }
      }
    }

    if (!frameioToken) {
      return NextResponse.json(
        {
          error: "Frame.io not connected. Please connect your Frame.io account.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    // Fetch all projects from Frame.io
    const frameio = createFrameioClient(frameioToken);
    const projects = await frameio.getProjects();

    const allFolders: Array<{
      frameio_asset_id: string;
      frameio_project_id: string;
      project_name: string;
      folder_name: string;
      path_breadcrumb: string;
      synced_at: string;
    }> = [];

    // Fetch folder tree for each project
    for (const project of projects) {
      // Also add the root project as a folder option
      allFolders.push({
        frameio_asset_id: project.root_asset_id,
        frameio_project_id: project.id,
        project_name: project.name,
        folder_name: "(Root)",
        path_breadcrumb: project.name,
        synced_at: new Date().toISOString(),
      });

      const folders = await frameio.getFolderTree(
        project.root_asset_id,
        project.name,
        project.id
      );

      allFolders.push(
        ...folders.map((f) => ({
          frameio_asset_id: f.asset_id,
          frameio_project_id: f.project_id,
          project_name: f.project_name,
          folder_name: f.folder_name,
          path_breadcrumb: f.path_breadcrumb,
          synced_at: new Date().toISOString(),
        }))
      );
    }

    // Upsert folders to Supabase (preserve is_enabled status)
    for (const folder of allFolders) {
      // Check if folder already exists
      const { data: existing } = await supabase
        .from("frameio_folders")
        .select("id, is_enabled, custom_label, admin_note")
        .eq("frameio_asset_id", folder.frameio_asset_id)
        .single();

      if (existing) {
        // Update existing folder, preserve user settings
        await supabase
          .from("frameio_folders")
          .update({
            project_name: folder.project_name,
            folder_name: folder.folder_name,
            path_breadcrumb: folder.path_breadcrumb,
            synced_at: folder.synced_at,
          })
          .eq("id", existing.id);
      } else {
        // Insert new folder
        await supabase.from("frameio_folders").insert(folder);
      }
    }

    return NextResponse.json({
      success: true,
      synced: allFolders.length,
      projects: projects.length,
    });
  } catch (error) {
    console.error("Frame.io sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync with Frame.io",
      },
      { status: 500 }
    );
  }
}
