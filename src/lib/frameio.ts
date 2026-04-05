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
    const allProjects: FrameioProject[] = [];
    const errors: string[] = [];
    const debugInfo: string[] = [];

    // Step 1: Get current user info
    let me: {
      id: string;
      account_id?: string;
      accounts?: { id: string }[];
      _type?: string;
    };
    try {
      me = await this.request<{
        id: string;
        account_id?: string;
        accounts?: { id: string }[];
        _type?: string;
      }>("/me");
      debugInfo.push(`me.id=${me.id}, me.account_id=${me.account_id}`);
    } catch (e) {
      throw new Error(`Failed to authenticate with Frame.io: ${e}`);
    }

    // Step 2: Get teams the user is a member of
    let teams: { id: string; name: string }[] = [];

    // Try getting user's teams directly
    try {
      const userTeams = await this.request<{ id: string; name: string }[]>(
        `/accounts/${me.account_id}/teams`
      );
      if (Array.isArray(userTeams)) {
        teams = userTeams;
        debugInfo.push(`account_teams=${teams.length}`);
      }
    } catch (e) {
      debugInfo.push(`account_teams_error`);
    }

    // Fallback: try /teams endpoint
    if (teams.length === 0) {
      try {
        const directTeams = await this.request<{ id: string; name: string }[]>("/teams");
        if (Array.isArray(directTeams)) {
          teams = directTeams;
          debugInfo.push(`direct_teams=${teams.length}`);
        }
      } catch (e) {
        debugInfo.push(`direct_teams_error`);
      }
    }

    // Step 3: Get projects from each team
    for (const team of teams) {
      try {
        const teamProjects = await this.request<FrameioProject[]>(
          `/teams/${team.id}/projects`
        );
        if (Array.isArray(teamProjects) && teamProjects.length > 0) {
          debugInfo.push(`team_${team.id}_projects=${teamProjects.length}`);
          allProjects.push(...teamProjects);
        }
      } catch (e) {
        errors.push(`Team ${team.id}: ${e}`);
      }
    }

    // Step 4: If still no projects, check if this is a personal account
    // For personal/free accounts, try getting the root asset directly
    if (allProjects.length === 0 && me.account_id) {
      try {
        // Get the account details which might contain the root asset
        const account = await this.request<{
          id: string;
          name: string;
          root_asset_id?: string;
        }>(`/accounts/${me.account_id}`);

        debugInfo.push(`account_name=${account.name}`);

        if (account.root_asset_id) {
          // This account has a root asset, treat it as a single project
          allProjects.push({
            id: me.account_id,
            name: account.name || "My Projects",
            root_asset_id: account.root_asset_id,
          });
          debugInfo.push(`using_account_root_asset`);
        }
      } catch (e) {
        errors.push(`Account details: ${e}`);
      }
    }

    // Dedupe projects by ID
    const uniqueProjects = Array.from(
      new Map(allProjects.map((p) => [p.id, p])).values()
    );

    if (uniqueProjects.length === 0) {
      throw new Error(
        `No projects found. Debug: ${debugInfo.join(", ")}. Errors: ${errors.slice(0, 2).join("; ")}`
      );
    }

    return uniqueProjects;
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
