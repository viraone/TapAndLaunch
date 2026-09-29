import {
  Home,
  Search,
  ShoppingCart,
  User,
  Settings,
  Calendar,
  Mail,
  Info,
  Circle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  search: Search,
  cart: ShoppingCart,
  shop: ShoppingCart,
  user: User,
  profile: User,
  settings: Settings,
  calendar: Calendar,
  contact: Mail,
  mail: Mail,
  info: Info,
};

/** The "tabs" bar's own icons (StageTime's outline set), keyed like ICONS;
 * a name without one here falls back to ICONS. */
const TAB_ICON_PATHS: Record<string, string[]> = {
  home: ["m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z"],
  plus: ["M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  pencil: [
    "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125",
  ],
  pumpkin: [
    "M12 3c-1 1.4-1 2.6 0 4M4 10c0-2.2 2.1-3.5 3.8-3.5M20 10c0-2.2-2.1-3.5-3.8-3.5M4 10c0 6.2 3.2 10.5 8 10.5s8-4.3 8-10.5c-2.1-1.6-5-2.3-8-2.3s-5.9.7-8 2.3Z",
    "m9 11 1.6 1.6M10.6 11 9 12.6m5.4-1.6 1.6 1.6M16.6 11 15 12.6M9 16c1 1 2 1.5 3 1.5s2-.5 3-1.5",
  ],
};
const TAB_ICON_ALIASES: Record<string, string> = {
  add: "plus",
  submit: "plus",
  edit: "pencil",
  signup: "pencil",
  halloween: "pumpkin",
};

function TabIcon({ name }: { name: string }) {
  const key = name.toLowerCase();
  const paths = TAB_ICON_PATHS[TAB_ICON_ALIASES[key] ?? key];
  if (!paths) {
    const Icon = ICONS[key] ?? Circle;
    return <Icon className="h-6 w-6 shrink-0" />;
  }
  return (
    <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  );
}

export interface BottomNavItem {
  label: string;
  icon: string;
  page_path: string;
}

/**
 * Renders a fixed bottom tab bar. Icon names are a small free-text
 * vocabulary (`theme.bottom_nav[].icon`), not an enum — unrecognized names
 * fall back to a plain dot rather than rejecting the config, since a
 * creator typing "cart" vs "shop" shouldn't be a validation error.
 *
 * `variant="tabs"` is a taller bar fixed to the bottom of the screen with
 * large icons, as StageTime has it; the page leaves room for it (pb-20). Its
 * hover background is [&:hover]:, not hover:, so a tapped tab keeps it on a
 * phone, as on StageTime.
 */
export function BottomNav({
  items,
  variant = "compact",
  activePagePath,
  onNavigate,
}: {
  items: BottomNavItem[];
  variant?: "compact" | "tabs";
  activePagePath?: string;
  onNavigate: (pagePath: string) => void;
}) {
  if (items.length === 0) return null;

  if (variant === "tabs") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-16 max-w-md items-center justify-around border-t border-border bg-background/95 px-3 backdrop-blur">
        {items.map((item, index) => {
          const active = item.page_path === activePagePath;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onNavigate(item.page_path)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[12px] px-2 py-2 transition [&:hover]:bg-muted ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <TabIcon name={item.icon} />
              <span className="text-center text-[11px] font-semibold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex border-t bg-background">
      {items.map((item, index) => {
        const Icon = ICONS[item.icon.toLowerCase()] ?? Circle;
        const active = item.page_path === activePagePath;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onNavigate(item.page_path)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
