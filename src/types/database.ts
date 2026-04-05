export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      frameio_folders: {
        Row: {
          id: string;
          frameio_asset_id: string;
          frameio_project_id: string;
          project_name: string;
          folder_name: string;
          custom_label: string | null;
          admin_note: string | null;
          is_enabled: boolean;
          path_breadcrumb: string;
          synced_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          frameio_asset_id: string;
          frameio_project_id: string;
          project_name: string;
          folder_name: string;
          custom_label?: string | null;
          admin_note?: string | null;
          is_enabled?: boolean;
          path_breadcrumb: string;
          synced_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          frameio_asset_id?: string;
          frameio_project_id?: string;
          project_name?: string;
          folder_name?: string;
          custom_label?: string | null;
          admin_note?: string | null;
          is_enabled?: boolean;
          path_breadcrumb?: string;
          synced_at?: string;
          created_at?: string;
        };
      };
      upload_events: {
        Row: {
          id: string;
          frameio_asset_id: string | null;
          folder_id: string;
          uploader_name: string | null;
          uploader_email: string | null;
          file_name: string;
          file_size_bytes: number;
          status: "pending" | "uploading" | "completed" | "failed";
          error_message: string | null;
          ip_address_hash: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          frameio_asset_id?: string | null;
          folder_id: string;
          uploader_name?: string | null;
          uploader_email?: string | null;
          file_name: string;
          file_size_bytes: number;
          status?: "pending" | "uploading" | "completed" | "failed";
          error_message?: string | null;
          ip_address_hash?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          frameio_asset_id?: string | null;
          folder_id?: string;
          uploader_name?: string | null;
          uploader_email?: string | null;
          file_name?: string;
          file_size_bytes?: number;
          status?: "pending" | "uploading" | "completed" | "failed";
          error_message?: string | null;
          ip_address_hash?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      admins: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      upload_status: "pending" | "uploading" | "completed" | "failed";
    };
  };
}

export type FrameioFolder = Database["public"]["Tables"]["frameio_folders"]["Row"];
export type UploadEvent = Database["public"]["Tables"]["upload_events"]["Row"];
export type Admin = Database["public"]["Tables"]["admins"]["Row"];
