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
export type BlockType =
  | "text"
  | "image"
  | "video"
  | "contact_form"
  | "product_list"
  | "event_calendar"
  | "zoom_meeting"
  | "canva_embed"
  | "listing_directory";
export type AnalyticsEventType =
  | "view"
  | "install"
  | "click"
  | "push_sent"
  | "push_opened"
  | "email_sent"
  | "sms_sent"
  | "order_placed"
  | "booking_created";
export type OrderStatus = "pending" | "fulfilled" | "cancelled";

export type CustomDomainStatus = "pending" | "verified" | "error";

/** One DNS record Vercel's Domains API asks the tenant to add, passed
 * through verbatim — see `lib/domains/vercel.ts`. */
export interface DomainVerificationRecord {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

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
  /** "dark" puts the published app on a dark zinc palette, the whole page
   * (not just the column) in `background_color`. Unset keeps the light look. */
  color_scheme?: "light" | "dark";
  /** false hides the "Sign in" bar at the top of a published app. */
  show_member_bar?: boolean;
  /** "tabs" is a tall tab bar fixed to the bottom of the screen, with large
   * icons (StageTime's look). Unset keeps the compact bar. */
  bottom_nav_style?: "compact" | "tabs";
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
  | ContactFormBlockConfig
  | ProductListBlockConfig
  | EventCalendarBlockConfig
  | ZoomMeetingBlockConfig
  | CanvaEmbedBlockConfig
  | ListingDirectoryBlockConfig;

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

/** No product selection here — always shows every active product for the
 * app. See the migration comment on `products` for why. */
export interface ProductListBlockConfig {
  title?: string;
}

/** No event selection either, same reasoning as `ProductListBlockConfig`. */
export interface EventCalendarBlockConfig {
  title?: string;
}

export interface ZoomMeetingBlockConfig {
  title?: string;
  description?: string;
  meeting_url?: string;
}

export interface CanvaEmbedBlockConfig {
  /** A Canva design's public "embed" share link (renders as an iframe). */
  embed_url?: string;
  /** An optional button under/instead of the embed, linking to any Canva
   * design/template/profile URL. */
  button_label?: string;
  button_url?: string;
}

/** StageTime's open-mic directory: shows the app's active listings (the
 * `listings` table) that happen today in `time_zone`. */
export interface ListingDirectoryBlockConfig {
  title?: string;
  /** An IANA zone such as "America/Los_Angeles"; "today" is worked out in it. */
  time_zone?: string;
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
          custom_domain_status: CustomDomainStatus | null;
          custom_domain_verification: DomainVerificationRecord[];
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
      products: {
        Row: {
          id: string;
          app_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          currency: string;
          image_url: string | null;
          is_active: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          app_id: string;
          name: string;
          price_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          app_id: string;
          member_id: string | null;
          customer_name: string;
          customer_email: string;
          status: OrderStatus;
          total_cents: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          app_id: string;
          customer_name: string;
          customer_email: string;
          total_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          unit_price_cents: number;
          quantity: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          product_name: string;
          unit_price_cents: number;
          quantity: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          app_id: string;
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string | null;
          capacity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & {
          app_id: string;
          title: string;
          starts_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          event_id: string;
          app_id: string;
          member_id: string | null;
          customer_name: string;
          customer_email: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          event_id: string;
          app_id: string;
          customer_name: string;
          customer_email: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          app_id: string;
          slug: string;
          record: Record<string, unknown>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listings"]["Row"]> & {
          app_id: string;
          slug: string;
          record: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["listings"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
    };
  };
}
