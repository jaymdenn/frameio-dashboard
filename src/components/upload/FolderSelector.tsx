"use client";

import { useState, useMemo } from "react";
import { Search, Folder, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameioFolder } from "@/types/database";

interface FolderSelectorProps {
  folders: FrameioFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  disabled?: boolean;
}

export function FolderSelector({
  folders,
  selectedFolderId,
  onSelect,
  disabled = false,
}: FolderSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Group folders by project
  const groupedFolders = useMemo(() => {
    const groups: Record<string, FrameioFolder[]> = {};

    for (const folder of folders) {
      if (!groups[folder.project_name]) {
        groups[folder.project_name] = [];
      }
      groups[folder.project_name].push(folder);
    }

    return groups;
  }, [folders]);

  // Filter folders based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedFolders;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, FrameioFolder[]> = {};

    for (const [projectName, projectFolders] of Object.entries(groupedFolders)) {
      const matchingFolders = projectFolders.filter(
        (folder) =>
          folder.project_name.toLowerCase().includes(query) ||
          folder.folder_name.toLowerCase().includes(query) ||
          folder.path_breadcrumb.toLowerCase().includes(query) ||
          folder.custom_label?.toLowerCase().includes(query)
      );

      if (matchingFolders.length > 0) {
        filtered[projectName] = matchingFolders;
      }
    }

    return filtered;
  }, [groupedFolders, searchQuery]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  if (folders.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-8 text-center">
        <Folder className="mx-auto h-12 w-12 text-zinc-400" />
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          No upload destinations are configured.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Select Destination Folder
      </label>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search projects and folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Selected folder display */}
      {selectedFolder && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
          <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            {selectedFolder.custom_label || selectedFolder.path_breadcrumb}
          </span>
        </div>
      )}

      {/* Folder list */}
      <div className="max-h-[300px] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        {Object.entries(filteredGroups).length === 0 ? (
          <div className="p-4 text-center text-sm text-zinc-500">
            No folders match your search
          </div>
        ) : (
          Object.entries(filteredGroups).map(([projectName, projectFolders]) => (
            <div key={projectName}>
              {/* Project header */}
              <div className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {projectName}
              </div>

              {/* Folders */}
              {projectFolders.map((folder) => {
                const isSelected = folder.id === selectedFolderId;
                const displayName = folder.custom_label || folder.folder_name;
                const breadcrumb = folder.path_breadcrumb
                  .replace(projectName + " > ", "")
                  .split(" > ");

                return (
                  <button
                    key={folder.id}
                    onClick={() => onSelect(folder.id)}
                    disabled={disabled}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      isSelected &&
                        "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    )}
                  >
                    <Folder
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isSelected
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-zinc-400"
                      )}
                    />
                    <span className="flex items-center gap-1 truncate">
                      {breadcrumb.map((part, index) => (
                        <span key={index} className="flex items-center">
                          {index > 0 && (
                            <ChevronRight className="h-3 w-3 mx-1 text-zinc-400" />
                          )}
                          <span
                            className={cn(
                              index === breadcrumb.length - 1
                                ? "font-medium text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-500 dark:text-zinc-400"
                            )}
                          >
                            {index === breadcrumb.length - 1 ? displayName : part}
                          </span>
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
