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

    // Fetch all projects from Frame.io
    const frameio = createFrameioClient();
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
