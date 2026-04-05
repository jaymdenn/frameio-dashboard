import { NextRequest, NextResponse } from "next/server";
import { createFrameioClient } from "@/lib/frameio";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // 10 initiations per hour per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

function hashIP(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      folder_id,
      file_name,
      file_size,
      file_type,
      uploader_name,
      uploader_email,
    } = body;

    // Validate required fields
    if (!folder_id || !file_name || !file_size) {
      return NextResponse.json(
        { error: "Missing required fields: folder_id, file_name, file_size" },
        { status: 400 }
      );
    }

    // Validate file type (must be video)
    const videoMimeTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/avi",
      "video/mxf",
      "application/mxf",
    ];

    const isVideoFile =
      videoMimeTypes.some((type) => file_type?.startsWith(type)) ||
      file_type?.startsWith("video/") ||
      /\.(mp4|mov|mxf|avi|mkv|r3d|braw)$/i.test(file_name);

    if (!isVideoFile) {
      return NextResponse.json(
        { error: "Only video files are allowed" },
        { status: 400 }
      );
    }

    // Get folder details from Supabase
    const supabase = await createServiceClient();
    const { data: folder, error: folderError } = await supabase
      .from("frameio_folders")
      .select("*")
      .eq("id", folder_id)
      .eq("is_enabled", true)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Folder not found or not enabled" },
        { status: 404 }
      );
    }

    // Create upload event in Supabase
    const { data: uploadEvent, error: eventError } = await supabase
      .from("upload_events")
      .insert({
        folder_id: folder.id,
        file_name,
        file_size_bytes: file_size,
        uploader_name: uploader_name || null,
        uploader_email: uploader_email || null,
        status: "pending",
        ip_address_hash: hashIP(ip),
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to create upload event:", eventError);
      return NextResponse.json(
        { error: "Failed to initiate upload" },
        { status: 500 }
      );
    }

    // Initiate Frame.io upload
    const frameio = createFrameioClient();
    const uploadSession = await frameio.initiateUpload(
      folder.frameio_asset_id,
      file_name,
      file_size,
      file_type || "video/mp4"
    );

    // Update upload event with Frame.io asset ID
    await supabase
      .from("upload_events")
      .update({
        frameio_asset_id: uploadSession.asset_id,
        status: "uploading",
      })
      .eq("id", uploadEvent.id);

    return NextResponse.json({
      upload_event_id: uploadEvent.id,
      asset_id: uploadSession.asset_id,
      upload_urls: uploadSession.upload_urls,
    });
  } catch (error) {
    console.error("Upload initiation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to initiate upload",
      },
      { status: 500 }
    );
  }
}
