import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, Upload, CheckCircle, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { FrameioFolder, UploadEvent } from "@/types/database";

interface UploadEventWithFolder extends UploadEvent {
  frameio_folders: Pick<FrameioFolder, "project_name" | "folder_name"> | null;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats
  const { data: foldersData } = await supabase
    .from("frameio_folders")
    .select("id, is_enabled");

  const foldersResult = {
    total: foldersData?.length || 0,
    enabled: foldersData?.filter((f: { is_enabled: boolean }) => f.is_enabled).length || 0,
  };

  const { data: uploadsData } = await supabase
    .from("upload_events")
    .select("status");

  const uploadsResult = {
    total: uploadsData?.length || 0,
    completed: uploadsData?.filter((e: { status: string }) => e.status === "completed").length || 0,
    failed: uploadsData?.filter((e: { status: string }) => e.status === "failed").length || 0,
  };

  const { data: recentUploadsData } = await supabase
    .from("upload_events")
    .select("*, frameio_folders(project_name, folder_name)")
    .order("created_at", { ascending: false })
    .limit(10);

  const recentUploads = (recentUploadsData || []) as UploadEventWithFolder[];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar />

      <main className="pl-64">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            Dashboard
          </h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                    <Folder className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Enabled Folders
                    </p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {foldersResult.enabled}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Total Uploads
                    </p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {uploadsResult.total}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Successful
                    </p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {uploadsResult.completed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Failed
                    </p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {uploadsResult.failed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              {recentUploads.length === 0 ? (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No uploads yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                          File
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                          Folder
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                          Uploader
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUploads.map((upload) => (
                        <tr
                          key={upload.id}
                          className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                          <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">
                            {upload.file_name}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                            {upload.frameio_folders?.project_name || "Unknown"}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                            {upload.uploader_name || upload.uploader_email || "Anonymous"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                upload.status === "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : upload.status === "failed"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                              }`}
                            >
                              {upload.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                            {formatDate(upload.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
