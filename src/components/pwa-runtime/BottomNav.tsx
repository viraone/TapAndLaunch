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
 */
export function BottomNav({
  items,
  activePagePath,
  onNavigate,
}: {
  items: BottomNavItem[];
  activePagePath?: string;
  onNavigate: (pagePath: string) => void;
}) {
  if (items.length === 0) return null;

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
