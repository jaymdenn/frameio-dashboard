"use client";

import { useState, useEffect } from "react";
import { Download, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatBytes, formatDate } from "@/lib/utils";
import type { UploadEvent, FrameioFolder } from "@/types/database";

export const dynamic = "force-dynamic";

interface UploadEventWithFolder extends UploadEvent {
  frameio_folders: Pick<FrameioFolder, "project_name" | "folder_name"> | null;
}

const PAGE_SIZE = 25;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<UploadEventWithFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projects, setProjects] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const supabase = createClient();

  const fetchLogs = async () => {
    setLoading(true);

    let query = supabase
      .from("upload_events")
      .select("*, frameio_folders(project_name, folder_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (searchQuery) {
      query = query.or(
        `file_name.ilike.%${searchQuery}%,uploader_name.ilike.%${searchQuery}%,uploader_email.ilike.%${searchQuery}%`
      );
    }

    const { data, count, error } = await query;

    if (!error) {
      let filteredData = data || [];

      // Client-side project filter (since we need the joined data)
      if (projectFilter !== "all") {
        filteredData = filteredData.filter(
          (log) => log.frameio_folders?.project_name === projectFilter
        );
      }

      setLogs(filteredData as UploadEventWithFolder[]);
      setTotalCount(count || 0);
    }

    setLoading(false);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("frameio_folders")
      .select("project_name")
      .order("project_name");

    if (data) {
      const uniqueProjects = [...new Set(data.map((d) => d.project_name))];
      setProjects(uniqueProjects);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, searchQuery, projectFilter]);

  const exportCSV = () => {
    const headers = [
      "Date",
      "File Name",
      "File Size",
      "Project",
      "Folder",
      "Uploader Name",
      "Uploader Email",
      "Status",
      "Error",
    ];

    const rows = logs.map((log) => [
      formatDate(log.created_at),
      log.file_name,
      formatBytes(log.file_size_bytes),
      log.frameio_folders?.project_name || "",
      log.frameio_folders?.folder_name || "",
      log.uploader_name || "",
      log.uploader_email || "",
      log.status,
      log.error_message || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upload-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar />

      <main className="pl-64">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Upload Logs
            </h1>
            <Button variant="outline" onClick={exportCSV} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search files or uploaders..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(0);
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="uploading">Uploading</option>
                  <option value="pending">Pending</option>
                </Select>

                <Select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All Projects</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setProjectFilter("all");
                    setPage(0);
                  }}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Upload Events</span>
                <span className="text-sm font-normal text-zinc-500">
                  {totalCount} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-12">
                  No upload logs found
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            File
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            Size
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            Destination
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            Uploader
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr
                            key={log.id}
                            className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">
                              {log.file_name}
                            </td>
                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                              {formatBytes(log.file_size_bytes)}
                            </td>
                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                              {log.frameio_folders ? (
                                <>
                                  {log.frameio_folders.project_name} /{" "}
                                  {log.frameio_folders.folder_name}
                                </>
                              ) : (
                                <span className="text-zinc-400">Unknown</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                              <div className="max-w-[150px]">
                                <p className="truncate">
                                  {log.uploader_name || "Anonymous"}
                                </p>
                                {log.uploader_email && (
                                  <p className="text-xs text-zinc-400 truncate">
                                    {log.uploader_email}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  log.status === "completed"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                    : log.status === "failed"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                }`}
                              >
                                {log.status}
                              </span>
                              {log.error_message && (
                                <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate">
                                  {log.error_message}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Page {page + 1} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages - 1, p + 1))
                          }
                          disabled={page >= totalPages - 1}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
