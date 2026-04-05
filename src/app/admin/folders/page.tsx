"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Folder, Check, X, Edit2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn, formatDate } from "@/lib/utils";
import type { FrameioFolder } from "@/types/database";

export const dynamic = "force-dynamic";

export default function AdminFoldersPage() {
  const [folders, setFolders] = useState<FrameioFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNote, setEditNote] = useState("");

  const supabase = createClient();

  const fetchFolders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("frameio_folders")
      .select("*")
      .order("project_name", { ascending: true })
      .order("path_breadcrumb", { ascending: true });

    if (!error && data) {
      setFolders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/frameio/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({
          success: true,
          message: `Synced ${data.synced} folders from ${data.projects} projects`,
        });
        fetchFolders();
      } else {
        setSyncResult({
          success: false,
          message: data.error || "Sync failed",
        });
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: "Failed to sync with Frame.io",
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleFolder = async (folder: FrameioFolder) => {
    const newEnabled = !folder.is_enabled;

    // Optimistic update
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folder.id ? { ...f, is_enabled: newEnabled } : f
      )
    );

    const { error } = await supabase
      .from("frameio_folders")
      .update({ is_enabled: newEnabled })
      .eq("id", folder.id);

    if (error) {
      // Revert on error
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folder.id ? { ...f, is_enabled: folder.is_enabled } : f
        )
      );
    }
  };

  const startEditing = (folder: FrameioFolder) => {
    setEditingFolder(folder.id);
    setEditLabel(folder.custom_label || "");
    setEditNote(folder.admin_note || "");
  };

  const saveEdit = async (folderId: string) => {
    const { error } = await supabase
      .from("frameio_folders")
      .update({
        custom_label: editLabel || null,
        admin_note: editNote || null,
      })
      .eq("id", folderId);

    if (!error) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? { ...f, custom_label: editLabel || null, admin_note: editNote || null }
            : f
        )
      );
    }

    setEditingFolder(null);
  };

  const cancelEdit = () => {
    setEditingFolder(null);
    setEditLabel("");
    setEditNote("");
  };

  // Group folders by project
  const groupedFolders: Record<string, FrameioFolder[]> = {};
  for (const folder of folders) {
    if (!groupedFolders[folder.project_name]) {
      groupedFolders[folder.project_name] = [];
    }
    groupedFolders[folder.project_name].push(folder);
  }

  const lastSynced = folders.length > 0 ? folders[0].synced_at : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar />

      <main className="pl-64">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Folder Management
              </h1>
              {lastSynced && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Last synced: {formatDate(lastSynced)}
                </p>
              )}
            </div>
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw
                className={cn("h-4 w-4 mr-2", syncing && "animate-spin")}
              />
              {syncing ? "Syncing..." : "Sync from Frame.io"}
            </Button>
          </div>

          {syncResult && (
            <div
              className={cn(
                "mb-6 p-4 rounded-lg",
                syncResult.success
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              )}
            >
              {syncResult.message}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : folders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Folder className="mx-auto h-12 w-12 text-zinc-400 mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  No Folders Synced
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                  Click &quot;Sync from Frame.io&quot; to fetch your projects and folders.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedFolders).map(([projectName, projectFolders]) => (
                <Card key={projectName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-emerald-600" />
                      {projectName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {projectFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border",
                            folder.is_enabled
                              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                              : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            {editingFolder === folder.id ? (
                              <div className="space-y-3">
                                <Input
                                  placeholder="Custom label (optional)"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                />
                                <Input
                                  placeholder="Admin note (not shown to uploaders)"
                                  value={editNote}
                                  onChange={(e) => setEditNote(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => saveEdit(folder.id)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                    {folder.custom_label || folder.folder_name}
                                  </p>
                                  {folder.custom_label && (
                                    <span className="text-xs text-zinc-400">
                                      ({folder.folder_name})
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                  {folder.path_breadcrumb}
                                </p>
                                {folder.admin_note && (
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 italic">
                                    Note: {folder.admin_note}
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          {editingFolder !== folder.id && (
                            <div className="flex items-center gap-4 ml-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(folder)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={folder.is_enabled}
                                onChange={() => toggleFolder(folder)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
