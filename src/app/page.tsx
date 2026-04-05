"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Upload, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDropZone } from "@/components/upload/FileDropZone";
import { FolderSelector } from "@/components/upload/FolderSelector";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { useChunkedUpload } from "@/hooks/useChunkedUpload";
import type { FrameioFolder } from "@/types/database";

function UploadContent() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");

  const [folders, setFolders] = useState<FrameioFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    status,
    progress,
    bytesUploaded,
    errorMessage,
    uploadFile,
    reset,
    isUploading,
  } = useChunkedUpload({
    onComplete: () => setShowSuccess(true),
  });

  // Fetch available folders
  useEffect(() => {
    async function fetchFolders() {
      try {
        const url = projectFilter
          ? `/api/folders?project=${projectFilter}`
          : "/api/folders";
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setFolders(data);
        }
      } catch (error) {
        console.error("Failed to fetch folders:", error);
      } finally {
        setLoadingFolders(false);
      }
    }

    fetchFolders();
  }, [projectFilter]);

  const handleUpload = async () => {
    if (!selectedFile || !selectedFolderId) return;

    await uploadFile(
      selectedFile,
      selectedFolderId,
      uploaderName || undefined,
      uploaderEmail || undefined
    );
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
    setShowSuccess(false);
  };

  const canUpload = selectedFile && selectedFolderId && !isUploading;

  // Success screen
  if (showSuccess && status === "completed") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mb-6">
              <Video className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Upload Complete!
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8">
              Your video has been successfully uploaded to Frame.io
            </p>
            <Button onClick={handleReset} size="lg" className="w-full">
              Upload Another Video
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-2xl mb-4">
            <Upload className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Video Upload
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Upload your video directly to Frame.io
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Uploader attribution (optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Your Name (optional)"
                placeholder="Enter your name"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                disabled={isUploading}
              />
              <Input
                label="Email (optional)"
                type="email"
                placeholder="Enter your email"
                value={uploaderEmail}
                onChange={(e) => setUploaderEmail(e.target.value)}
                disabled={isUploading}
              />
            </div>

            {/* Folder selector */}
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : (
              <FolderSelector
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={setSelectedFolderId}
                disabled={isUploading}
              />
            )}

            {/* File drop zone or upload progress */}
            {status === "idle" || status === "failed" ? (
              <FileDropZone
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
                onClearFile={() => setSelectedFile(null)}
                disabled={isUploading}
              />
            ) : (
              <UploadProgress
                fileName={selectedFile?.name || ""}
                fileSize={selectedFile?.size || 0}
                progress={progress}
                bytesUploaded={bytesUploaded}
                status={status === "completed" ? "completed" : "uploading"}
                errorMessage={errorMessage || undefined}
                onRetry={handleReset}
              />
            )}

            {/* Upload button */}
            {status === "idle" && (
              <Button
                onClick={handleUpload}
                disabled={!canUpload}
                size="lg"
                className="w-full"
              >
                <Upload className="w-5 h-5 mr-2" />
                Start Upload
              </Button>
            )}

            {status === "failed" && (
              <Button onClick={handleReset} variant="outline" size="lg" className="w-full">
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-6">
          Files are uploaded directly to Frame.io. No file size limit.
        </p>
      </div>
    </main>
  );
}

function UploadLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </main>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<UploadLoading />}>
      <UploadContent />
    </Suspense>
  );
}
