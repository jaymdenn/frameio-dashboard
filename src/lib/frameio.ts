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

    // Step 1: Get current user info
    let me: { id: string; account_id?: string; accounts?: { id: string }[] };
    try {
      me = await this.request<{
        id: string;
        account_id?: string;
        accounts?: { id: string }[];
      }>("/me");
      console.log("Frame.io /me response:", JSON.stringify(me));
    } catch (e) {
      throw new Error(`Failed to authenticate with Frame.io: ${e}`);
    }

    // Step 2: Get account ID - try multiple sources
    let accountIds: string[] = [];

    if (me.account_id) {
      accountIds.push(me.account_id);
    }

    if (me.accounts && Array.isArray(me.accounts)) {
      accountIds.push(...me.accounts.map(a => a.id));
    }

    // Try to fetch accounts list
    try {
      const accountsList = await this.request<{ id: string }[]>("/accounts");
      if (Array.isArray(accountsList)) {
        accountIds.push(...accountsList.map(a => a.id));
      }
    } catch (e) {
      console.log("Could not fetch /accounts:", e);
    }

    // Dedupe account IDs
    accountIds = [...new Set(accountIds)];
    console.log("Account IDs to check:", accountIds);

    // Step 3: For each account, try to get projects
    for (const accountId of accountIds) {
      // Method A: Get projects directly from account
      try {
        const projects = await this.request<FrameioProject[]>(
          `/accounts/${accountId}/projects`
        );
        if (Array.isArray(projects) && projects.length > 0) {
          console.log(`Found ${projects.length} projects in account ${accountId}`);
          allProjects.push(...projects);
        }
      } catch (e) {
        errors.push(`Account ${accountId} projects: ${e}`);
      }

      // Method B: Get teams then projects from each team
      try {
        const teams = await this.request<{ id: string; name: string }[]>(
          `/accounts/${accountId}/teams`
        );
        console.log(`Found ${teams.length} teams in account ${accountId}`);

        for (const team of teams) {
          try {
            const projects = await this.request<FrameioProject[]>(
              `/teams/${team.id}/projects`
            );
            if (Array.isArray(projects) && projects.length > 0) {
              console.log(`Found ${projects.length} projects in team ${team.name}`);
              allProjects.push(...projects);
            }
          } catch (e) {
            errors.push(`Team ${team.id}: ${e}`);
          }
        }
      } catch (e) {
        errors.push(`Account ${accountId} teams: ${e}`);
      }
    }

    // Method C: Try user's direct projects membership
    if (allProjects.length === 0) {
      try {
        const userProjects = await this.request<FrameioProject[]>(
          `/users/${me.id}/projects`
        );
        if (Array.isArray(userProjects) && userProjects.length > 0) {
          console.log(`Found ${userProjects.length} projects for user`);
          allProjects.push(...userProjects);
        }
      } catch (e) {
        errors.push(`User projects: ${e}`);
      }
    }

    // Dedupe projects by ID
    const uniqueProjects = Array.from(
      new Map(allProjects.map((p) => [p.id, p])).values()
    );

    if (uniqueProjects.length === 0) {
      console.error("All Frame.io API methods failed:", errors);
      throw new Error(
        `No projects found. Debug info: accountIds=[${accountIds.join(",")}], errors: ${errors.slice(0, 3).join("; ")}`
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
