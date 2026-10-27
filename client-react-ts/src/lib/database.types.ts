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
  | "water_purifier"
  | "pipe_fitting";

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
      user_settings: {
        Row: {
          user_id: string;
          preferences: Json;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          preferences?: Json;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          preferences?: Json;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      plants: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plant_connections: {
        Row: {
          id: string;
          plant_id: string;
          source_device_id: string;
          target_device_id: string;
          source_handle: string;
          target_handle: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          plant_id: string;
          source_device_id: string;
          target_device_id: string;
          source_handle?: string;
          target_handle?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          plant_id?: string;
          source_device_id?: string;
          target_device_id?: string;
          source_handle?: string;
          target_handle?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      plant_members: {
        Row: {
          id: string;
          plant_id: string;
          user_id: string;
          role: DeviceMemberRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plant_id: string;
          user_id: string;
          role?: DeviceMemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plant_id?: string;
          user_id?: string;
          role?: DeviceMemberRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plant_share_links: {
        Row: {
          id: string;
          plant_id: string;
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
          plant_id: string;
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
          plant_id?: string;
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
      plant_invites: {
        Row: {
          id: string;
          plant_id: string;
          invitee_id: string;
          invited_by: string;
          role: Exclude<DeviceMemberRole, "owner">;
          status: string;
          share_link_id: string | null;
          notification_id: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          plant_id: string;
          invitee_id: string;
          invited_by: string;
          role: Exclude<DeviceMemberRole, "owner">;
          status?: string;
          share_link_id?: string | null;
          notification_id?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          plant_id?: string;
          invitee_id?: string;
          invited_by?: string;
          role?: Exclude<DeviceMemberRole, "owner">;
          status?: string;
          share_link_id?: string | null;
          notification_id?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      plant_node_layouts: {
        Row: {
          plant_id: string;
          device_id: string;
          x: number;
          y: number;
          updated_at: string;
        };
        Insert: {
          plant_id: string;
          device_id: string;
          x?: number;
          y?: number;
          updated_at?: string;
        };
        Update: {
          plant_id?: string;
          device_id?: string;
          x?: number;
          y?: number;
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
          plant_id: string;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          type: DeviceType;
          name: string;
          plant_id: string;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          type?: DeviceType;
          name?: string;
          plant_id?: string;
          config?: Json;
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
      delete_my_device: {
        Args: { p_device_id: string };
        Returns: undefined;
      };
      rename_my_device: {
        Args: { p_device_id: string; p_name: string };
        Returns: undefined;
      };
      update_my_device_config: {
        Args: { p_device_id: string; p_config: Json };
        Returns: Json;
      };
      leave_device: {
        Args: { p_device_id: string };
        Returns: undefined;
      };
      create_my_device: {
        Args: {
          p_type: DeviceType;
          p_name: string;
          p_member_emails?: string[];
          p_member_role?: DeviceMemberRole;
          p_plant_id?: string | null;
        };
        Returns: string;
      };
      ensure_my_default_plant: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_my_plant: {
        Args: { p_name: string };
        Returns: string;
      };
      rename_my_plant: {
        Args: { p_plant_id: string; p_name: string };
        Returns: undefined;
      };
      delete_my_plant: {
        Args: { p_plant_id: string };
        Returns: undefined;
      };
      list_my_plants: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
          updated_at: string;
          role: DeviceMemberRole;
        }[];
      };
      user_is_plant_member: {
        Args: { p_plant_id: string };
        Returns: boolean;
      };
      user_can_admin_plant: {
        Args: { p_plant_id: string };
        Returns: boolean;
      };
      list_plant_roster: {
        Args: { p_plant_id: string };
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
      invite_plant_member_by_email: {
        Args: {
          p_plant_id: string;
          p_email: string;
          p_role?: DeviceMemberRole;
        };
        Returns: undefined;
      };
      create_plant_share_link: {
        Args: {
          p_plant_id: string;
          p_role?: DeviceMemberRole;
          p_expires_hours?: number | null;
          p_max_uses?: number | null;
        };
        Returns: string;
      };
      redeem_plant_share_link: {
        Args: { p_token: string };
        Returns: Json;
      };
      redeem_share_link: {
        Args: { p_token: string };
        Returns: Json;
      };
      create_pending_plant_invite_as: {
        Args: {
          p_plant_id: string;
          p_invitee_id: string;
          p_inviter_id: string;
          p_role?: DeviceMemberRole;
          p_share_link_id?: string | null;
        };
        Returns: string;
      };
      accept_plant_invite: {
        Args: { p_invite_id: string };
        Returns: Json;
      };
      decline_plant_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      revoke_plant_share_link: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      update_plant_member_role: {
        Args: { p_member_id: string; p_role: DeviceMemberRole };
        Returns: undefined;
      };
      remove_plant_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      leave_plant: {
        Args: { p_plant_id: string };
        Returns: undefined;
      };
      device_card_snapshots: {
        Args: { p_device_ids: string[] };
        Returns: Json;
      };
      delete_my_account: {
        Args: { p_delete_owned_devices?: boolean };
        Returns: undefined;
      };
      create_pending_device_invite_as: {
        Args: {
          p_device_id: string;
          p_invitee_id: string;
          p_inviter_id: string;
          p_role?: DeviceMemberRole;
          p_share_link_id?: string | null;
        };
        Returns: string;
      };
      accept_device_invite: {
        Args: { p_invite_id: string };
        Returns: Json;
      };
      decline_device_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      list_my_notifications: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          kind: string;
          title: string;
          body: string | null;
          data: Json;
          read_at: string | null;
          created_at: string;
          invite_status: string | null;
        }[];
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      delete_my_notification: {
        Args: { p_notification_id: string };
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
