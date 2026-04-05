"use client";

import { useState, useCallback, useRef } from "react";

interface UploadState {
  status: "idle" | "initiating" | "uploading" | "completing" | "completed" | "failed";
  progress: number;
  bytesUploaded: number;
  errorMessage: string | null;
}

interface ChunkedUploadOptions {
  onProgress?: (progress: number, bytesUploaded: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  chunkSize?: number; // Defaults to 25MB
  maxConcurrentUploads?: number;
}

const DEFAULT_CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks
const DEFAULT_MAX_CONCURRENT = 4;

export function useChunkedUpload(options: ChunkedUploadOptions = {}) {
  const {
    onProgress,
    onComplete,
    onError,
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxConcurrentUploads = DEFAULT_MAX_CONCURRENT,
  } = options;

  const [state, setState] = useState<UploadState>({
    status: "idle",
    progress: 0,
    bytesUploaded: 0,
    errorMessage: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadEventIdRef = useRef<string | null>(null);

  const uploadChunk = useCallback(
    async (
      url: string,
      chunk: Blob,
      chunkIndex: number,
      signal: AbortSignal
    ): Promise<boolean> => {
      try {
        const response = await fetch(url, {
          method: "PUT",
          body: chunk,
          headers: {
            "Content-Type": "application/octet-stream",
          },
          signal,
        });

        return response.ok;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          throw error;
        }
        console.error(`Chunk ${chunkIndex} upload failed:`, error);
        return false;
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (
      file: File,
      folderId: string,
      uploaderName?: string,
      uploaderEmail?: string
    ) => {
      // Reset state
      setState({
        status: "initiating",
        progress: 0,
        bytesUploaded: 0,
        errorMessage: null,
      });

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        // Step 1: Initiate upload with our API
        const initiateResponse = await fetch("/api/upload/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder_id: folderId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            uploader_name: uploaderName,
            uploader_email: uploaderEmail,
          }),
          signal,
        });

        if (!initiateResponse.ok) {
          const errorData = await initiateResponse.json();
          throw new Error(errorData.error || "Failed to initiate upload");
        }

        const { upload_event_id, upload_urls } = await initiateResponse.json();
        uploadEventIdRef.current = upload_event_id;

        if (!upload_urls || upload_urls.length === 0) {
          throw new Error("No upload URLs received from Frame.io");
        }

        // Step 2: Upload chunks
        setState((prev) => ({ ...prev, status: "uploading" }));

        const totalChunks = upload_urls.length;
        const actualChunkSize = Math.ceil(file.size / totalChunks);
        let completedChunks = 0;
        let uploadedBytes = 0;

        // Upload chunks with concurrency limit
        const uploadQueue: Promise<void>[] = [];

        for (let i = 0; i < totalChunks; i++) {
          const start = i * actualChunkSize;
          const end = Math.min(start + actualChunkSize, file.size);
          const chunk = file.slice(start, end);
          const url = upload_urls[i];

          const uploadPromise = (async () => {
            const success = await uploadChunk(url, chunk, i, signal);
            if (!success) {
              throw new Error(`Failed to upload chunk ${i + 1}`);
            }

            completedChunks++;
            uploadedBytes += chunk.size;

            const progress = Math.round((completedChunks / totalChunks) * 100);
            setState((prev) => ({
              ...prev,
              progress,
              bytesUploaded: uploadedBytes,
            }));
            onProgress?.(progress, uploadedBytes);
          })();

          uploadQueue.push(uploadPromise);

          // Limit concurrent uploads
          if (uploadQueue.length >= maxConcurrentUploads) {
            await Promise.race(uploadQueue);
            // Remove completed promises
            const pendingPromises: Promise<void>[] = [];
            for (const p of uploadQueue) {
              const result = await Promise.race([
                p.then(() => "resolved"),
                Promise.resolve("pending"),
              ]);
              if (result === "pending") {
                pendingPromises.push(p);
              }
            }
            uploadQueue.length = 0;
            uploadQueue.push(...pendingPromises);
          }
        }

        // Wait for remaining uploads
        await Promise.all(uploadQueue);

        // Step 3: Mark upload as complete
        setState((prev) => ({ ...prev, status: "completing" }));

        await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_event_id,
            success: true,
          }),
        });

        setState({
          status: "completed",
          progress: 100,
          bytesUploaded: file.size,
          errorMessage: null,
        });

        onComplete?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        // Record failure if we have an upload event ID
        if (uploadEventIdRef.current) {
          await fetch("/api/upload/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              upload_event_id: uploadEventIdRef.current,
              success: false,
              error_message: errorMessage,
            }),
          }).catch(console.error);
        }

        setState((prev) => ({
          ...prev,
          status: "failed",
          errorMessage,
        }));

        onError?.(errorMessage);
      }
    },
    [uploadChunk, maxConcurrentUploads, onProgress, onComplete, onError]
  );

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      status: "idle",
      progress: 0,
      bytesUploaded: 0,
      errorMessage: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      status: "idle",
      progress: 0,
      bytesUploaded: 0,
      errorMessage: null,
    });
    uploadEventIdRef.current = null;
  }, []);

  return {
    ...state,
    uploadFile,
    cancelUpload,
    reset,
    isUploading: state.status === "uploading" || state.status === "initiating",
  };
}
