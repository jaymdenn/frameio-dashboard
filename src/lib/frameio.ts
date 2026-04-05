/**
 * Frame.io V2 API Client
 * Server-side only - never expose API token to client
 */

const FRAMEIO_API_V2 = "https://api.frame.io/v2";
const FRAMEIO_API_V4 = "https://api.frame.io/v4";

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
  private useV4: boolean = false;
  private accountId: string = "";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useV4: boolean = false
  ): Promise<T> {
    const baseUrl = useV4 ? FRAMEIO_API_V4 : FRAMEIO_API_V2;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      // Required for legacy developer tokens on V4 accounts
      "x-frameio-legacy-token-auth": "true",
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
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
   * Supports both V2 and V4 Frame.io API
   */
  async getProjects(): Promise<FrameioProject[]> {
    const allProjects: FrameioProject[] = [];
    const errors: string[] = [];
    const debugInfo: string[] = [];

    // Step 1: Get current user info (V2 API)
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
      debugInfo.push(`me.id=${me.id?.slice(0, 8)}, account_id=${me.account_id?.slice(0, 8)}`);
      this.accountId = me.account_id || "";
    } catch (e) {
      throw new Error(`Failed to authenticate with Frame.io: ${e}`);
    }

    // Step 2: Try V4 API first (for V4 accounts)
    // V4 endpoint: /v4/accounts/{account_id}/workspaces then /v4/accounts/{account_id}/workspaces/{workspace_id}/projects
    if (me.account_id) {
      try {
        // Try V4 workspaces endpoint
        const v4Workspaces = await this.request<Array<{ id: string; name: string }>>(
          `/accounts/${me.account_id}/workspaces`,
          {},
          true // use V4
        );

        if (Array.isArray(v4Workspaces) && v4Workspaces.length > 0) {
          debugInfo.push(`v4_workspaces=${v4Workspaces.length}`);
          this.useV4 = true;

          for (const workspace of v4Workspaces) {
            try {
              // V4 projects endpoint
              const v4Projects = await this.request<Array<{
                id: string;
                name: string;
                root_folder_id?: string;
              }>>(
                `/accounts/${me.account_id}/workspaces/${workspace.id}/projects`,
                {},
                true // use V4
              );

              if (Array.isArray(v4Projects)) {
                debugInfo.push(`v4_ws_${workspace.name}_projects=${v4Projects.length}`);
                // Map V4 response to our project format
                for (const proj of v4Projects) {
                  allProjects.push({
                    id: proj.id,
                    name: proj.name,
                    root_asset_id: proj.root_folder_id || proj.id,
                  });
                }
              }
            } catch (e) {
              debugInfo.push(`v4_ws_${workspace.id}_error`);
            }
          }
        }
      } catch (e) {
        debugInfo.push(`v4_workspaces_error`);
      }
    }

    // Step 3: If V4 didn't work, try V2 API workspaces
    if (allProjects.length === 0 && me.account_id) {
      try {
        const accountWorkspaces = await this.request<{ id: string; name: string }[]>(
          `/accounts/${me.account_id}/workspaces`
        );
        if (Array.isArray(accountWorkspaces) && accountWorkspaces.length > 0) {
          debugInfo.push(`v2_workspaces=${accountWorkspaces.length}`);

          for (const workspace of accountWorkspaces) {
            try {
              const workspaceProjects = await this.request<FrameioProject[]>(
                `/workspaces/${workspace.id}/projects`
              );
              if (Array.isArray(workspaceProjects) && workspaceProjects.length > 0) {
                debugInfo.push(`v2_ws_${workspace.name}_projects=${workspaceProjects.length}`);
                allProjects.push(...workspaceProjects);
              }
            } catch (e) {
              errors.push(`V2 Workspace ${workspace.id}: ${e}`);
            }
          }
        }
      } catch (e) {
        debugInfo.push(`v2_workspaces_error`);
      }
    }

    // Step 4: Try V2 teams (older account structure)
    if (allProjects.length === 0) {
      let teams: { id: string; name: string }[] = [];

      try {
        const userTeams = await this.request<{ id: string; name: string }[]>(
          `/accounts/${me.account_id}/teams`
        );
        if (Array.isArray(userTeams)) {
          teams = userTeams;
          debugInfo.push(`v2_account_teams=${teams.length}`);
        }
      } catch (e) {
        debugInfo.push(`v2_account_teams_error`);
      }

      if (teams.length === 0) {
        try {
          const directTeams = await this.request<{ id: string; name: string }[]>("/teams");
          if (Array.isArray(directTeams)) {
            teams = directTeams;
            debugInfo.push(`v2_direct_teams=${teams.length}`);
          }
        } catch (e) {
          debugInfo.push(`v2_direct_teams_error`);
        }
      }

      for (const team of teams) {
        try {
          const teamProjects = await this.request<FrameioProject[]>(
            `/teams/${team.id}/projects`
          );
          if (Array.isArray(teamProjects) && teamProjects.length > 0) {
            debugInfo.push(`v2_team_${team.id}_projects=${teamProjects.length}`);
            allProjects.push(...teamProjects);
          }
        } catch (e) {
          errors.push(`V2 Team ${team.id}: ${e}`);
        }
      }
    }

    // Step 5: Try user memberships
    if (allProjects.length === 0 && me.id) {
      try {
        const memberships = await this.request<
          Array<{
            project: FrameioProject;
          }>
        >(`/users/${me.id}/memberships`);

        if (Array.isArray(memberships)) {
          for (const membership of memberships) {
            if (membership.project) {
              allProjects.push(membership.project);
            }
          }
          debugInfo.push(`v2_memberships=${memberships.length}`);
        }
      } catch (e) {
        debugInfo.push(`v2_memberships_error`);
      }
    }

    // Step 6: Try account root asset as last resort
    if (allProjects.length === 0 && me.account_id) {
      try {
        const account = await this.request<{
          id: string;
          name: string;
          root_asset_id?: string;
        }>(`/accounts/${me.account_id}`);

        debugInfo.push(`account_name=${account.name}`);

        if (account.root_asset_id) {
          allProjects.push({
            id: me.account_id,
            name: account.name || "My Projects",
            root_asset_id: account.root_asset_id,
          });
          debugInfo.push(`using_account_root`);
        }
      } catch (e) {
        errors.push(`Account: ${e}`);
      }
    }

    // Dedupe projects by ID
    const uniqueProjects = Array.from(
      new Map(allProjects.map((p) => [p.id, p])).values()
    );

    if (uniqueProjects.length === 0) {
      throw new Error(
        `No projects found. Debug: ${debugInfo.join(", ")}. First error: ${errors[0] || "none"}`
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
