// Hand-written types mirroring supabase/migrations/0001_init.sql.
//
// Phase 1 note: there is no live Supabase project wired up yet, so these are
// maintained by hand instead of generated with `supabase gen types
// typescript`. Once a project is linked, replace this file by running:
//
//   supabase gen types typescript --linked > src/types/database.ts
//
// and update the hand-written domain types below (BlockConfig, ThemeConfig,
// ManifestConfig) to match however that generator shapes `jsonb` columns
// (it emits `Json`, so the narrower types here stay as app-level casts).

export type Role = "admin" | "creator" | "client";
export type AppStatus = "draft" | "published";
export type BlockType = "text" | "image" | "video" | "contact_form";
export type AnalyticsEventType =
  | "view"
  | "install"
  | "click"
  | "push_sent"
  | "push_opened"
  | "email_sent"
  | "sms_sent";

export type NotificationChannel = "push" | "email" | "sms";

/** "all" reaches every member (and, for push, subscriptions with no member
 * at all); "tier" reaches only members whose `tier` matches exactly. */
export type NotificationTarget = { type: "all" } | { type: "tier"; tier: string };

export interface OrganizationBranding {
  logo_url?: string;
  primary_color?: string;
  footer_text?: string;
  custom_domain?: string;
}

export interface ThemeConfig {
  primary_color?: string;
  background_color?: string;
  font_family?: string;
  header_title?: string;
  bottom_nav?: Array<{ label: string; icon: string; page_path: string }>;
}

export interface ManifestConfig {
  name?: string;
  short_name?: string;
  description?: string;
  theme_color?: string;
  background_color?: string;
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  icon_url?: string; // single source icon; the manifest route derives sizes
}

export type BlockConfig =
  | TextBlockConfig
  | ImageBlockConfig
  | VideoBlockConfig
  | ContactFormBlockConfig;

export interface TextBlockConfig {
  heading?: string;
  body?: string;
}

export interface ImageBlockConfig {
  src?: string;
  alt?: string;
}

export interface VideoBlockConfig {
  provider?: "youtube" | "vimeo" | "embed";
  url?: string;
}

export interface ContactFormBlockConfig {
  title?: string;
  fields?: Array<{ name: string; label: string; type: "text" | "email" | "textarea"; required?: boolean }>;
  submit_label?: string;
}

// `Relationships`/`Views`/`Functions` below are required by supabase-js's
// `GenericTable`/`GenericSchema` constraints (see
// node_modules/@supabase/supabase-js/src/lib/rest/types/common/common.ts) —
// omitting them doesn't error, it just makes every query resolve to `never`.
// Left empty here: nothing in this schema uses PostgREST embedded-resource
// typing (`.select("foo(bar)")`) that depends on `Relationships`, and there
// are no views/functions yet.
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          branding: OrganizationBranding;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Role;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["memberships"]["Row"]> & {
          organization_id: string;
          user_id: string;
          role: Role;
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Row"]>;
        Relationships: [];
      };
      apps: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          status: AppStatus;
          custom_domain: string | null;
          theme: ThemeConfig;
          manifest: ManifestConfig;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["apps"]["Row"]> & {
          organization_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["apps"]["Row"]>;
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          app_id: string;
          name: string;
          path: string;
          is_home: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pages"]["Row"]> & {
          app_id: string;
          name: string;
          path: string;
        };
        Update: Partial<Database["public"]["Tables"]["pages"]["Row"]>;
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          page_id: string;
          type: BlockType;
          position: number;
          config: BlockConfig;
          min_tier: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["blocks"]["Row"]> & {
          page_id: string;
          type: BlockType;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Row"]>;
        Relationships: [];
      };
      app_members: {
        Row: {
          id: string;
          app_id: string;
          email: string;
          password_hash: string;
          display_name: string | null;
          phone: string | null;
          tier: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_members"]["Row"]> & {
          app_id: string;
          email: string;
          password_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_members"]["Row"]>;
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          app_id: string;
          page_id: string | null;
          member_id: string | null;
          event_type: AnalyticsEventType;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["analytics_events"]["Row"]> & {
          app_id: string;
          event_type: AnalyticsEventType;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_events"]["Row"]>;
        Relationships: [];
      };
      form_submissions: {
        Row: {
          id: string;
          app_id: string;
          page_id: string | null;
          data: Record<string, string>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["form_submissions"]["Row"]> & {
          app_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["form_submissions"]["Row"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          app_id: string;
          member_id: string | null;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]> & {
          app_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
