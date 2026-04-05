"use client";

import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileVideo, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled?: boolean;
}

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/avi",
  "video/mxf",
  "application/mxf",
];

const ACCEPTED_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".mxf",
  ".avi",
  ".mkv",
  ".r3d",
  ".braw",
];

export function FileDropZone({
  onFileSelect,
  selectedFile,
  onClearFile,
  disabled = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    setError(null);

    // Check file type
    const isValidType = ACCEPTED_VIDEO_TYPES.some((type) =>
      file.type.startsWith(type)
    );
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isValidType && !hasValidExtension) {
      setError(
        "Invalid file type. Please upload a video file (.mp4, .mov, .mxf, .avi, .mkv, .r3d, .braw)"
      );
      return false;
    }

    return true;
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    },
    [disabled, onFileSelect, validateFile]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onFileSelect, validateFile]
  );

  if (selectedFile) {
    return (
      <div className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <FileVideo className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {selectedFile.name}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatBytes(selectedFile.size)}
              </p>
            </div>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearFile}
              aria-label="Remove file"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
          isDragging
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          type="file"
          accept={[...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_EXTENSIONS].join(",")}
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Upload video file"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Upload className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Drag and drop your video here
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              or click to browse
            </p>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Supported formats: MP4, MOV, MXF, AVI, MKV, R3D, BRAW
          </p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
