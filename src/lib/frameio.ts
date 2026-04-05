/**
 * Frame.io API Client - Supports both V2 and V4 APIs
 * V4 API is required for accounts managed via Adobe Admin Console
 * Server-side only - never expose API token to client
 * @see https://next.developer.frame.io/platform/docs/overview
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

// V4 API response types
interface V4Account {
  id: string;
  name: string;
}

interface V4Workspace {
  id: string;
  name: string;
}

interface V4Project {
  id: string;
  name: string;
  root_folder_id: string; // V4 uses root_folder_id instead of root_asset_id
}

interface V4PaginatedResponse<T> {
  data: T[];
  pagination?: {
    next_cursor?: string;
  };
}

class FrameioClient {
  private token: string;
  private accountId: string = "";

  constructor(token: string) {
    this.token = token;
  }

  private async requestV2<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FRAMEIO_API_V2}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
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
      // Include endpoint in error for debugging
      throw new Error(`V2 ${endpoint}: ${response.status} - ${error.slice(0, 200)}`);
    }

    return response.json();
  }

  private async requestV4<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FRAMEIO_API_V4}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
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
      throw new Error(`Frame.io V4 API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Keep old request method for backwards compatibility
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useV4: boolean = false
  ): Promise<T> {
    return useV4
      ? this.requestV4<T>(endpoint, options)
      : this.requestV2<T>(endpoint, options);
  }

  /**
   * Get all projects for the authenticated account
   * Uses V4 API first (for Adobe-managed accounts), falls back to V2
   * @see https://next.developer.frame.io/platform/docs/guides/accounts-projects-and-workspaces
   */
  async getProjects(): Promise<FrameioProject[]> {
    const allProjects: FrameioProject[] = [];
    const errors: string[] = [];
    const debugInfo: string[] = [];

    // Step 1: Get user info from V2 /me endpoint (works for all account types)
    let me: {
      id: string;
      account_id?: string;
      accounts?: { id: string }[];
      _type?: string;
    };
    try {
      me = await this.requestV2<{
        id: string;
        account_id?: string;
        accounts?: { id: string }[];
        _type?: string;
      }>("/me");
      debugInfo.push(`me.id=${me.id?.slice(0, 8)}, account_id=${me.account_id?.slice(0, 8)}`);
      this.accountId = me.account_id || "";
    } catch (e) {
      throw new Error(`Failed to authenticate with Frame.io: ${e}. Debug: ${debugInfo.join(", ")}`);
    }

    // Step 2: Try V4 API with the account ID from /me
    if (me.account_id) {
      try {
        // Get workspaces for this account using V4
        const workspaces = await this.requestV4<V4PaginatedResponse<V4Workspace>>(
          `/accounts/${me.account_id}/workspaces`
        );

        if (workspaces.data && Array.isArray(workspaces.data) && workspaces.data.length > 0) {
          debugInfo.push(`v4_workspaces=${workspaces.data.length}`);

          for (const workspace of workspaces.data) {
            try {
              // Get projects for this workspace
              const projects = await this.requestV4<V4PaginatedResponse<V4Project>>(
                `/accounts/${me.account_id}/workspaces/${workspace.id}/projects`
              );

              if (projects.data && Array.isArray(projects.data)) {
                debugInfo.push(`v4_ws_${workspace.name}_projects=${projects.data.length}`);

                // Convert V4 project format to our format
                for (const project of projects.data) {
                  allProjects.push({
                    id: project.id,
                    name: project.name,
                    root_asset_id: project.root_folder_id, // V4 uses root_folder_id
                  });
                }
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              errors.push(`V4 ws ${workspace.id}: ${errMsg.slice(0, 80)}`);
            }
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        debugInfo.push(`v4_workspaces_error`);
        errors.push(`V4 workspaces: ${errMsg.slice(0, 80)}`);
      }
    }

    // If V4 worked, return results
    if (allProjects.length > 0) {
      return Array.from(new Map(allProjects.map((p) => [p.id, p])).values());
    }

    // Step 3: Fall back to V2 API methods
    debugInfo.push(`falling_back_to_v2`);


    // Get all accounts the user has access to
    let accounts: Array<{ id: string; name?: string }> = [];

    if (me.account_id) {
      accounts.push({ id: me.account_id });
    }
    if (me.accounts && Array.isArray(me.accounts)) {
      accounts.push(...me.accounts);
    }

    // Try to get accounts list
    try {
      const accountsList = await this.requestV2<Array<{ id: string; name: string }>>("/accounts");
      if (Array.isArray(accountsList)) {
        accounts.push(...accountsList);
        debugInfo.push(`accounts_list=${accountsList.length}`);
      }
    } catch (e) {
      debugInfo.push(`accounts_list_error`);
    }

    // Dedupe accounts
    accounts = Array.from(new Map(accounts.map(a => [a.id, a])).values());
    debugInfo.push(`total_accounts=${accounts.length}`);

    // For each account, try to get projects directly
    for (const account of accounts) {
      try {
        const accountProjects = await this.requestV2<FrameioProject[]>(
          `/accounts/${account.id}/projects`
        );
        if (Array.isArray(accountProjects) && accountProjects.length > 0) {
          debugInfo.push(`account_${account.id?.slice(0,8)}_projects=${accountProjects.length}`);
          allProjects.push(...accountProjects);
        }
      } catch (e) {
        // Expected to fail, continue
      }
    }

    // Try V2 API workspaces
    if (allProjects.length === 0 && me.account_id) {
      try {
        const accountWorkspaces = await this.requestV2<{ id: string; name: string }[]>(
          `/accounts/${me.account_id}/workspaces`
        );
        if (Array.isArray(accountWorkspaces) && accountWorkspaces.length > 0) {
          debugInfo.push(`v2_workspaces=${accountWorkspaces.length}`);

          for (const workspace of accountWorkspaces) {
            try {
              const workspaceProjects = await this.requestV2<FrameioProject[]>(
                `/workspaces/${workspace.id}/projects`
              );
              if (Array.isArray(workspaceProjects) && workspaceProjects.length > 0) {
                debugInfo.push(`v2_ws_${workspace.name}_projects=${workspaceProjects.length}`);
                allProjects.push(...workspaceProjects);
              }
            } catch (e) {
              errors.push(`${e}`);
            }
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        errors.push(errMsg.slice(0, 100));
        debugInfo.push(`v2_workspaces_error`);
      }
    }

    // Try /projects/shared endpoint - this gets all projects user has access to
    try {
      const sharedProjects = await this.requestV2<FrameioProject[]>("/projects/shared");
      if (Array.isArray(sharedProjects) && sharedProjects.length > 0) {
        debugInfo.push(`v2_shared=${sharedProjects.length}`);
        allProjects.push(...sharedProjects);
      } else {
        debugInfo.push(`v2_shared=0`);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      debugInfo.push(`v2_shared_err`);
      errors.push(`shared: ${errMsg.slice(0, 60)}`);
    }

    // Try /me with include parameter to get projects directly
    if (allProjects.length === 0) {
      try {
        const meWithProjects = await this.requestV2<{
          projects?: FrameioProject[];
          shared_projects?: FrameioProject[];
          owned_projects?: FrameioProject[];
        }>("/me?include=projects,shared_projects,owned_projects");

        if (meWithProjects.projects && Array.isArray(meWithProjects.projects)) {
          debugInfo.push(`me_proj=${meWithProjects.projects.length}`);
          allProjects.push(...meWithProjects.projects);
        }
        if (meWithProjects.shared_projects && Array.isArray(meWithProjects.shared_projects)) {
          debugInfo.push(`me_shared=${meWithProjects.shared_projects.length}`);
          allProjects.push(...meWithProjects.shared_projects);
        }
        if (meWithProjects.owned_projects && Array.isArray(meWithProjects.owned_projects)) {
          debugInfo.push(`me_owned=${meWithProjects.owned_projects.length}`);
          allProjects.push(...meWithProjects.owned_projects);
        }
      } catch (e) {
        debugInfo.push(`me_include_err`);
      }
    }

    // Try user memberships endpoint
    if (allProjects.length === 0 && me.id) {
      try {
        const memberships = await this.requestV2<Array<{
          project?: FrameioProject;
          resource?: FrameioProject;
          target?: FrameioProject;
        }>>(`/users/${me.id}/memberships`);

        if (Array.isArray(memberships) && memberships.length > 0) {
          debugInfo.push(`memberships=${memberships.length}`);
          for (const m of memberships) {
            if (m.project) allProjects.push(m.project);
            else if (m.resource) allProjects.push(m.resource);
            else if (m.target) allProjects.push(m.target);
          }
        }
      } catch (e) {
        debugInfo.push(`memberships_err`);
      }
    }

    // Try V2 teams (older account structure)
    if (allProjects.length === 0) {
      let teams: { id: string; name: string }[] = [];

      try {
        const userTeams = await this.requestV2<{ id: string; name: string }[]>(
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
          const directTeams = await this.requestV2<{ id: string; name: string }[]>("/teams");
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
          const teamProjects = await this.requestV2<FrameioProject[]>(
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

    // Try /projects endpoint directly (some accounts support this)
    if (allProjects.length === 0) {
      try {
        const directProjects = await this.requestV2<FrameioProject[]>("/projects");
        if (Array.isArray(directProjects) && directProjects.length > 0) {
          debugInfo.push(`v2_direct_projects=${directProjects.length}`);
          allProjects.push(...directProjects);
        }
      } catch (e) {
        debugInfo.push(`v2_direct_projects_error`);
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
   * Get all child assets (folders/files) of a parent folder
   * Tries V4 API first, falls back to V2
   */
  async getChildren(folderId: string, accountId?: string): Promise<FrameioAsset[]> {
    const acctId = accountId || this.accountId;

    // Try V4 first if we have an account ID
    if (acctId) {
      try {
        const v4Response = await this.requestV4<V4PaginatedResponse<{
          id: string;
          name: string;
          type: "folder" | "file" | "version_stack";
        }>>(`/accounts/${acctId}/folders/${folderId}/children`);

        if (v4Response.data && Array.isArray(v4Response.data)) {
          return v4Response.data.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            parent_id: folderId,
            project_id: "",
          }));
        }
      } catch (e) {
        // V4 failed, fall back to V2
      }
    }

    // Fall back to V2
    return this.requestV2<FrameioAsset[]>(`/assets/${folderId}/children`);
  }

  /**
   * Get folder tree for a project (recursive)
   */
  async getFolderTree(
    rootAssetId: string,
    projectName: string,
    projectId: string,
    parentPath: string = "",
    accountId?: string
  ): Promise<
    Array<{
      asset_id: string;
      project_id: string;
      project_name: string;
      folder_name: string;
      path_breadcrumb: string;
    }>
  > {
    const acctId = accountId || this.accountId;
    const children = await this.getChildren(rootAssetId, acctId);
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
          currentPath,
          acctId
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
