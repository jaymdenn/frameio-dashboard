import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { upload_event_id, success, error_message } = body;

    if (!upload_event_id) {
      return NextResponse.json(
        { error: "Missing upload_event_id" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    if (success) {
      // Mark upload as completed
      const { error } = await supabase
        .from("upload_events")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", upload_event_id);

      if (error) {
        console.error("Failed to update upload event:", error);
        return NextResponse.json(
          { error: "Failed to record completion" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      // Mark upload as failed
      const { error } = await supabase
        .from("upload_events")
        .update({
          status: "failed",
          error_message: error_message || "Upload failed",
        })
        .eq("id", upload_event_id);

      if (error) {
        console.error("Failed to update upload event:", error);
      }

      return NextResponse.json({ success: false });
    }
  } catch (error) {
    console.error("Upload completion error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process completion",
      },
      { status: 500 }
    );
  }
}
