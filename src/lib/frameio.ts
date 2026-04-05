/**
 * Frame.io V2 API Client
 * Server-side only - never expose API token to client
 */

const FRAMEIO_API_BASE = "https://api.frame.io/v2";

interface FrameioProject {
  id: string;
  name: string;
  root_asset_id: string;
}

interface FrameioAsset {
  id: string;
  name: string;
  type: "folder" | "file" | "version_stack" | "review_link";
  parent_id: string | null;
  project_id: string;
  filesize?: number;
  upload_urls?: string[];
  upload_completed_at?: string;
}

interface FrameioUploadSession {
  asset_id: string;
  upload_urls: string[];
}

interface CreateAssetParams {
  name: string;
  type: "file" | "folder";
  filesize?: number;
  filetype?: string;
}

class FrameioClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FRAMEIO_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Frame.io API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get all projects for the authenticated account
   */
  async getProjects(): Promise<FrameioProject[]> {
    // First get the current user's account info
    const me = await this.request<{ id: string; account_id: string }>("/me");

    // Get accounts the user belongs to
    const accounts = await this.request<{ id: string; name: string }[]>(`/accounts`);

    const allProjects: FrameioProject[] = [];

    // Try to get projects from each account
    for (const account of accounts) {
      try {
        // Get teams for this account
        const teams = await this.request<{ id: string }[]>(`/accounts/${account.id}/teams`);

        for (const team of teams) {
          try {
            const projects = await this.request<FrameioProject[]>(
              `/teams/${team.id}/projects`
            );
            allProjects.push(...projects);
          } catch (e) {
            console.log(`Could not fetch projects for team ${team.id}:`, e);
          }
        }
      } catch (e) {
        console.log(`Could not fetch teams for account ${account.id}:`, e);
      }
    }

    // Fallback: try legacy /teams endpoint if no projects found
    if (allProjects.length === 0) {
      try {
        const teams = await this.request<{ id: string }[]>("/teams");
        for (const team of teams) {
          const projects = await this.request<FrameioProject[]>(
            `/teams/${team.id}/projects`
          );
          allProjects.push(...projects);
        }
      } catch (e) {
        console.log("Legacy teams endpoint also failed:", e);
      }
    }

    if (allProjects.length === 0) {
      throw new Error("No projects found. Please ensure your Frame.io API token has access to at least one project.");
    }

    return allProjects;
  }

  /**
   * Get all child assets (folders/files) of a parent asset
   */
  async getChildren(assetId: string): Promise<FrameioAsset[]> {
    return this.request<FrameioAsset[]>(`/assets/${assetId}/children`);
  }

  /**
   * Get folder tree for a project (recursive)
   */
  async getFolderTree(
    rootAssetId: string,
    projectName: string,
    projectId: string,
    parentPath: string = ""
  ): Promise<
    Array<{
      asset_id: string;
      project_id: string;
      project_name: string;
      folder_name: string;
      path_breadcrumb: string;
    }>
  > {
    const children = await this.getChildren(rootAssetId);
    const folders: Array<{
      asset_id: string;
      project_id: string;
      project_name: string;
      folder_name: string;
      path_breadcrumb: string;
    }> = [];

    for (const child of children) {
      if (child.type === "folder") {
        const currentPath = parentPath
          ? `${parentPath} > ${child.name}`
          : `${projectName} > ${child.name}`;

        folders.push({
          asset_id: child.id,
          project_id: projectId,
          project_name: projectName,
          folder_name: child.name,
          path_breadcrumb: currentPath,
        });

        // Recursively get subfolders
        const subfolders = await this.getFolderTree(
          child.id,
          projectName,
          projectId,
          currentPath
        );
        folders.push(...subfolders);
      }
    }

    return folders;
  }

  /**
   * Create a new asset (file or folder) and get upload URLs
   */
  async createAsset(
    parentId: string,
    params: CreateAssetParams
  ): Promise<FrameioAsset> {
    return this.request<FrameioAsset>(`/assets/${parentId}/children`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Initiate a file upload - returns upload URLs for chunked upload
   */
  async initiateUpload(
    parentId: string,
    fileName: string,
    fileSize: number,
    fileType: string
  ): Promise<FrameioUploadSession> {
    const asset = await this.createAsset(parentId, {
      name: fileName,
      type: "file",
      filesize: fileSize,
      filetype: fileType,
    });

    return {
      asset_id: asset.id,
      upload_urls: asset.upload_urls || [],
    };
  }

  /**
   * Get asset details
   */
  async getAsset(assetId: string): Promise<FrameioAsset> {
    return this.request<FrameioAsset>(`/assets/${assetId}`);
  }

  /**
   * Verify upload is complete
   */
  async verifyUpload(assetId: string): Promise<boolean> {
    const asset = await this.getAsset(assetId);
    return !!asset.upload_completed_at;
  }
}

export function createFrameioClient(token?: string): FrameioClient {
  const apiToken = token || process.env.FRAMEIO_API_TOKEN;

  if (!apiToken) {
    throw new Error("Frame.io API token is required");
  }

  return new FrameioClient(apiToken);
}

export type { FrameioProject, FrameioAsset, FrameioUploadSession };
