import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project");

    const supabase = await createClient();

    let query = supabase
      .from("frameio_folders")
      .select("*")
      .eq("is_enabled", true)
      .order("project_name", { ascending: true })
      .order("path_breadcrumb", { ascending: true });

    if (projectId) {
      query = query.eq("frameio_project_id", projectId);
    }

    const { data: folders, error } = await query;

    if (error) {
      console.error("Failed to fetch folders:", error);
      return NextResponse.json(
        { error: "Failed to fetch folders" },
        { status: 500 }
      );
    }

    return NextResponse.json(folders || []);
  } catch (error) {
    console.error("Folders fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch folders",
      },
      { status: 500 }
    );
  }
}
