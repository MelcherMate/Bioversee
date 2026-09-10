export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DeviceType =
  | "bioreactor"
  | "pressure_vessel"
  | "membrane_bioreactor"
  | "water_purifier";

export type DeviceMemberRole = "owner" | "admin" | "operator" | "viewer";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          owner_id: string;
          type: DeviceType;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          type: DeviceType;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          type?: DeviceType;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      device_members: {
        Row: {
          id: string;
          device_id: string;
          user_id: string;
          role: DeviceMemberRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          user_id: string;
          role?: DeviceMemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          user_id?: string;
          role?: DeviceMemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      device_credentials: {
        Row: {
          id: string;
          device_id: string;
          key_hash: string;
          label: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          key_hash: string;
          label?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          key_hash?: string;
          label?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      device_share_links: {
        Row: {
          id: string;
          device_id: string;
          token: string;
          role: Exclude<DeviceMemberRole, "owner">;
          created_by: string;
          expires_at: string | null;
          revoked_at: string | null;
          use_count: number;
          max_uses: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          token: string;
          role: Exclude<DeviceMemberRole, "owner">;
          created_by: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          use_count?: number;
          max_uses?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          token?: string;
          role?: Exclude<DeviceMemberRole, "owner">;
          created_by?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          use_count?: number;
          max_uses?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      actuator_sliders: {
        Row: {
          id: string;
          device_id: string;
          name: string;
          state: number;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          name: string;
          state?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          name?: string;
          state?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      actuator_switches: {
        Row: {
          id: string;
          device_id: string;
          name: string;
          state: boolean;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          name: string;
          state?: boolean;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          name?: string;
          state?: boolean;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sensors: {
        Row: {
          id: string;
          device_id: string;
          name: string;
          value: number;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          name: string;
          value?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          name?: string;
          value?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_my_devices: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      ensure_user_devices: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      user_can_access_device: {
        Args: { p_device_id: string };
        Returns: boolean;
      };
      user_can_operate_device: {
        Args: { p_device_id: string };
        Returns: boolean;
      };
      user_can_admin_device: {
        Args: { p_device_id: string };
        Returns: boolean;
      };
      create_device_share_link: {
        Args: {
          p_device_id: string;
          p_role?: DeviceMemberRole;
          p_expires_hours?: number | null;
          p_max_uses?: number | null;
        };
        Returns: string;
      };
      redeem_device_share_link: {
        Args: { p_token: string };
        Returns: Json;
      };
      invite_device_member_by_email: {
        Args: {
          p_device_id: string;
          p_email: string;
          p_role?: DeviceMemberRole;
        };
        Returns: undefined;
      };
      list_device_roster: {
        Args: { p_device_id: string };
        Returns: {
          member_id: string;
          user_id: string;
          role: DeviceMemberRole;
          display_name: string;
          avatar_url: string | null;
          email: string | null;
          created_at: string;
        }[];
      };
      revoke_device_share_link: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      device_type: DeviceType;
      device_member_role: DeviceMemberRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
