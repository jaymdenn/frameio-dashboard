"use client";

import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadProgressProps {
  fileName: string;
  fileSize: number;
  progress: number;
  bytesUploaded: number;
  status: "uploading" | "completed" | "failed";
  errorMessage?: string;
  onRetry?: () => void;
}

export function UploadProgress({
  fileName,
  fileSize,
  progress,
  bytesUploaded,
  status,
  errorMessage,
  onRetry,
}: UploadProgressProps) {
  return (
    <div className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {fileName}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatBytes(bytesUploaded)} of {formatBytes(fileSize)}
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          {status === "uploading" && (
            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
          )}
          {status === "completed" && (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          )}
          {status === "failed" && <XCircle className="h-6 w-6 text-red-500" />}
        </div>
      </div>

      <Progress value={progress} max={100} showLabel />

      {status === "completed" && (
        <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Upload complete!
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Your video has been successfully uploaded to Frame.io
          </p>
        </div>
      )}

      {status === "failed" && (
        <div className="mt-4">
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 mb-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Upload failed
            </p>
            {errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {errorMessage}
              </p>
            )}
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="w-full">
              Retry Upload
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
