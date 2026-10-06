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

/** Why someone reported a published app. */
export type AppReportReason = "phishing" | "malware" | "scam" | "illegal" | "other";

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
  | "listing_directory"
  | "gas_directory"
  | "food_directory"
  | "open_mic_signup"
  | "class_finder"
  | "hero"
  | "price_list"
  | "hours"
  | "reviews"
  | "stats"
  | "gallery";
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
export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
export type PaymentMethod = "request" | "stripe";

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
  /** The bar at the top of every page: a logo, a name and a one-line tagline. */
  header_title?: string;
  header_tagline?: string;
  header_logo_url?: string;
  /** Set once the owner has saved their colours in App settings, so the "Get live" checklist can tick that step. */
  looks_confirmed?: boolean;
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
  | ListingDirectoryBlockConfig
  | GasDirectoryBlockConfig
  | FoodDirectoryBlockConfig
  | OpenMicSignupBlockConfig
  | ClassFinderBlockConfig
  | HeroBlockConfig
  | PriceListBlockConfig
  | HoursBlockConfig
  | ReviewsBlockConfig
  | StatsBlockConfig
  | GalleryBlockConfig;

/** A full-width photo with a headline and an optional button that opens another page of the app. */
export interface HeroBlockConfig {
  image_url?: string;
  eyebrow?: string;
  headline?: string;
  subtext?: string;
  button_label?: string;
  /** Path of the page the button opens, e.g. "classes". Empty hides the button. */
  button_page?: string;
}

/** A menu or price list: named sections of items with an optional description, price and small badge. */
export interface PriceListBlockConfig {
  title?: string;
  subtitle?: string;
  sections?: Array<{ name: string; items: Array<{ name: string; description?: string; price?: string; badge?: string }> }>;
}

/** Opening hours (one row per day or range), with an address that opens in maps and a phone number to tap. */
export interface HoursBlockConfig {
  title?: string;
  rows?: Array<{ label: string; value: string }>;
  address?: string;
  phone?: string;
}

/** Quotes from happy customers, with an optional star rating. */
export interface ReviewsBlockConfig {
  title?: string;
  items?: Array<{ quote: string; name: string; rating?: number }>;
}

/** A strip of two to four short facts, like "4.9★ rating" or "20+ classes a week". */
export interface StatsBlockConfig {
  items?: Array<{ value: string; label: string }>;
}

/** A grid of photos. */
export interface GalleryBlockConfig {
  title?: string;
  images?: Array<{ src: string; alt?: string }>;
}

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

export type FuelGrade = "regular" | "midgrade" | "premium" | "diesel";

/** GasPal. Ranking and the radius are computed from the *viewer's* live GPS
 * position; `fallback_*` is only used when the browser can't provide one
 * (permission denied, no GPS). */
export interface GasDirectoryBlockConfig {
  title?: string;
  radius_miles?: number;
  fallback_label?: string;
  fallback_latitude?: number;
  fallback_longitude?: number;
  default_sort?: "price" | "distance";
  default_grade?: FuelGrade;
}

/** Cuisine quick-filter keys; the catalog (labels, Google types, name
 * keywords) lives in lib/food/cuisines.ts. */
export type CuisineKey =
  | "ramen"
  | "vietnamese"
  | "thai"
  | "korean"
  | "taiwanese"
  | "japanese"
  | "mexican"
  | "pizza"
  | "burgers"
  | "mediterranean"
  | "ethiopian"
  | "indian"
  | "healthy"
  | "bars"
  | "ice_cream"
  | "dessert";

/** Google's opening-hours period shape, stored verbatim. `close` is absent
 * for a place that is open 24 hours. */
export interface OpeningPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

/** LiveBites. Restaurants around the *viewer's* live position with
 * open / closing-soon / closed computed live from Google's hours;
 * `fallback_*` is only used when the browser can't provide a position. */
/** One happy hour as the restaurant's website states it: which days (0 = Sunday), local start/end as "HH:MM",
 * and the deal in the restaurant's own words. `end` null = "until close". Read by tools/menu-ingest, shown by lib/food/happyHour.ts. */
export interface HappyHourWindow {
  days: number[];
  start: string;
  end: string | null;
  deal: string | null;
}

export interface FoodDirectoryBlockConfig {
  title?: string;
  subtitle?: string;
  radius_miles?: number;
  fallback_label?: string;
  fallback_latitude?: number;
  fallback_longitude?: number;
  /** Which cuisine pills to show, in order. "All" is always first. */
  cuisines?: CuisineKey[];
  default_sort?: "distance" | "open";
}

/** The kinds of group class FitnessNav sorts every class into ("other" classes are never shown). */
export type FitnessClassType = "pilates" | "yoga" | "spin" | "lifting" | "climbing";

/** FitnessNav: pick class types and a day, see every class at nearby studios on one page. Studios and classes come
 * from the morning job on the owner's Mac (tools/class-ingest) via fitness_studios / fitness_classes. */
export interface ClassFinderBlockConfig {
  title?: string;
  subtitle?: string;
  /** Shown as "Near …" and used for distances when the viewer doesn't share their location. */
  area_label?: string;
  area_latitude?: number;
  area_longitude?: number;
  /** Which class types to offer, in order. */
  class_types?: FitnessClassType[];
}

/** StageTime PNW's weekly showcase sign-up. Comedians sign in with an email
 * code and request a spot; the request list itself lives in the show's own
 * Supabase project (`supabase_url`, public `anon_key`), shared with the
 * StageTime iOS app and the Google Sheet sync there. Requests open
 * `opens_*` and close `closes_*`, in `time_zone`. */
export interface OpenMicSignupBlockConfig {
  title?: string;
  show_name?: string;
  venue?: string;
  show_time?: string;
  /** Square logo shown beside the show name. */
  logo_url?: string;
  /** The show's lineup feed (name, set, time, and the viewer's own status). Without it the closed screen stays simple. */
  lineup_url?: string;
  /** List everyone on the lineup (names, set, time) for signed-in comics from show day 6 AM. On unless set to false. */
  show_lineup?: boolean;
  supabase_url?: string;
  anon_key?: string;
  time_zone?: string;
  /** 0 = Sunday … 6 = Saturday; minutes after local midnight. */
  opens_weekday?: number;
  opens_minutes?: number;
  closes_weekday?: number;
  closes_minutes?: number;
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
          /** Google Maps features (Live food, Gas prices); a platform admin switches them on. */
          maps_enabled: boolean;
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
      app_code_versions: {
        Row: {
          id: string;
          app_id: string;
          version: number;
          files: Record<string, string>;
          prompt: string | null;
          summary: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_code_versions"]["Row"]> & { app_id: string; version: number; files: Record<string, string> };
        Update: Partial<Database["public"]["Tables"]["app_code_versions"]["Row"]>;
        Relationships: [];
      };
      org_ai_keys: {
        Row: {
          organization_id: string;
          provider: "anthropic" | "openai";
          encrypted_key: string;
          key_hint: string;
          model: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["org_ai_keys"]["Row"]> & {
          organization_id: string;
          provider: "anthropic" | "openai";
          encrypted_key: string;
          key_hint: string;
          model: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_ai_keys"]["Row"]>;
        Relationships: [];
      };
      ai_generations: {
        Row: { id: string; user_id: string; organization_id: string | null; kind: "describe" | "chat" | "code"; created_at: string; details: Record<string, unknown> | null };
        Insert: Partial<Database["public"]["Tables"]["ai_generations"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["ai_generations"]["Row"]>;
        Relationships: [];
      };
      org_billing: {
        Row: {
          organization_id: string;
          status: "trialing" | "active" | "past_due" | "canceled" | "complimentary";
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan_interval: "month" | "year" | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["org_billing"]["Row"]> & { organization_id: string };
        Update: Partial<Database["public"]["Tables"]["org_billing"]["Row"]>;
        Relationships: [];
      };
      stripe_accounts: {
        Row: {
          organization_id: string;
          stripe_account_id: string;
          charges_enabled: boolean;
          details_submitted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stripe_accounts"]["Row"]> & {
          organization_id: string;
          stripe_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["stripe_accounts"]["Row"]>;
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
          /** 'blocks' is the block builder; 'code' is an AI-written React app shown in a sandbox. */
          kind: "blocks" | "code";
          /** For code apps: the version visitors see. */
          code_published_version: number | null;
          /** Set when an admin deletes the app; it is hidden at once and erased 30 days later. */
          deleted_at: string | null;
          deleted_by: string | null;
          /** Set when TapAndLaunch takes the app down: it isn't served anywhere and can't be published again. */
          suspended_at: string | null;
          suspended_reason: string | null;
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
      platform_admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: Partial<{ user_id: string; created_at: string }>;
        Relationships: [];
      };
      app_backends: {
        Row: {
          app_id: string;
          provider: "supabase";
          url: string;
          anon_key: string;
          /** Database setup files the owner has run: path -> the content's hash when marked run. */
          applied_sql: Record<string, string>;
          connected_by: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_backends"]["Row"]> & { app_id: string; url: string; anon_key: string };
        Update: Partial<Database["public"]["Tables"]["app_backends"]["Row"]>;
        Relationships: [];
      };
      admin_todos: {
        Row: {
          id: string;
          /** Set for items the board seeds from code (added once, tick kept); null for items typed in on the page. */
          key: string | null;
          title: string;
          detail: string | null;
          section: string;
          sort: number;
          created_at: string;
          done_at: string | null;
          done_by: string | null;
          /** The item this is a step of; null for an item on the list itself. */
          parent_id: string | null;
          /** Which admin board the item belongs to: "tapandlaunch" or "fitnessnav". */
          board: string;
        };
        Insert: Partial<Database["public"]["Tables"]["admin_todos"]["Row"]> & { title: string };
        Update: Partial<Database["public"]["Tables"]["admin_todos"]["Row"]>;
        Relationships: [];
      };
      app_reports: {
        Row: {
          id: string;
          app_id: string;
          reason: AppReportReason;
          details: string | null;
          contact: string | null;
          reporter_hash: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["app_reports"]["Row"]> & { app_id: string; reason: AppReportReason };
        Update: Partial<Database["public"]["Tables"]["app_reports"]["Row"]>;
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
          /** Set when the member clicked Unsubscribe in an email; they're skipped by the Email channel. */
          email_unsubscribed_at: string | null;
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
          /** 'request' = the merchant follows up by hand; 'stripe' = paid on Stripe's checkout page. */
          payment_method: PaymentMethod;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          paid_at: string | null;
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
      gas_stations: {
        Row: {
          id: string;
          app_id: string;
          google_place_id: string | null;
          station_name: string;
          brand: string | null;
          address: string | null;
          latitude: number;
          longitude: number;
          price_regular: number | null;
          price_midgrade: number | null;
          price_premium: number | null;
          price_diesel: number | null;
          price_updated: Partial<Record<FuelGrade, string>>;
          price_source: "google" | "user" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["gas_stations"]["Row"]> & {
          app_id: string;
          station_name: string;
          latitude: number;
          longitude: number;
        };
        Update: Partial<Database["public"]["Tables"]["gas_stations"]["Row"]>;
        Relationships: [];
      };
      gas_fetch_cells: {
        Row: { app_id: string; cell_key: string; fetched_at: string };
        Insert: { app_id: string; cell_key: string; fetched_at?: string };
        Update: Partial<{ app_id: string; cell_key: string; fetched_at: string }>;
        Relationships: [];
      };
      gas_fetch_budget: {
        Row: { app_id: string; day: string; calls: number };
        Insert: { app_id: string; day: string; calls?: number };
        Update: Partial<{ app_id: string; day: string; calls: number }>;
        Relationships: [];
      };
      food_places: {
        Row: {
          id: string;
          app_id: string;
          google_place_id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          primary_type: string | null;
          types: string[];
          rating: number | null;
          rating_count: number | null;
          price_level: number | null;
          opening_periods: OpeningPeriod[];
          weekday_descriptions: string[];
          utc_offset_minutes: number | null;
          business_status: string | null;
          phone_national: string | null;
          phone_international: string | null;
          website: string | null;
          popular_dishes: { name: string; emoji: string; mentions: number }[] | null;
          dishes_synced_at: string | null;
          menu_url: string | null;
          menu_embeddable: boolean | null;
          menu_checked_at: string | null;
          menu_items: { sections: { name: string; items: { name: string; price: string | null; description: string | null }[] }[] } | null;
          menu_items_source_url: string | null;
          menu_items_at: string | null;
          menu_items_status: string | null;
          menu_items_model: string | null;
          happy_hour: { windows: HappyHourWindow[] } | null;
          happy_hour_source_url: string | null;
          happy_hour_at: string | null;
          happy_hour_status: string | null;
          google_synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["food_places"]["Row"]> & {
          app_id: string;
          google_place_id: string;
          name: string;
          latitude: number;
          longitude: number;
        };
        Update: Partial<Database["public"]["Tables"]["food_places"]["Row"]>;
        Relationships: [];
      };
      fitness_studios: {
        Row: {
          id: string;
          app_id: string;
          google_place_id: string | null;
          name: string;
          kind: string;
          address: string | null;
          neighborhood: string | null;
          latitude: number | null;
          longitude: number | null;
          website: string | null;
          schedule_url: string | null;
          read_status: string | null;
          read_at: string | null;
          class_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fitness_studios"]["Row"]> & { app_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["fitness_studios"]["Row"]>;
        Relationships: [];
      };
      fitness_classes: {
        Row: {
          id: string;
          app_id: string;
          studio_id: string;
          class_date: string;
          start_time: string;
          end_time: string | null;
          name: string;
          instructor: string | null;
          spots: string | null;
          class_type: string;
          online: boolean;
          read_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fitness_classes"]["Row"]> & {
          app_id: string;
          studio_id: string;
          class_date: string;
          start_time: string;
          name: string;
          class_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["fitness_classes"]["Row"]>;
        Relationships: [];
      };
      food_wait_reports: {
        Row: { id: string; app_id: string; place_id: string; wait_minutes: number; reported_at: string };
        Insert: { id?: string; app_id: string; place_id: string; wait_minutes: number; reported_at?: string };
        Update: Partial<{ id: string; app_id: string; place_id: string; wait_minutes: number; reported_at: string }>;
        Relationships: [];
      };
      food_fetch_cells: {
        Row: { app_id: string; cell_key: string; fetch_group: string; fetched_at: string };
        Insert: { app_id: string; cell_key: string; fetch_group?: string; fetched_at?: string };
        Update: Partial<{ app_id: string; cell_key: string; fetch_group: string; fetched_at: string }>;
        Relationships: [];
      };
      food_dish_budget: {
        Row: { app_id: string; month: string; calls: number };
        Insert: { app_id: string; month: string; calls?: number };
        Update: Partial<{ app_id: string; month: string; calls: number }>;
        Relationships: [];
      };
      food_fetch_budget: {
        Row: { app_id: string; day: string; calls: number };
        Insert: { app_id: string; day: string; calls?: number };
        Update: Partial<{ app_id: string; day: string; calls: number }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}
