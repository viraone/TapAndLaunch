import { Briefcase, CalendarDays, Dumbbell, Fuel, Mic, Plus, ShoppingBag, Sparkles, UtensilsCrossed, Users, type LucideIcon } from "lucide-react";
import type { TemplateIcon } from "@/lib/apps/templates";

/** The icon for each starter template, shared by the picker and the dashboard. */
export const TEMPLATE_ICONS: Record<TemplateIcon, LucideIcon> = {
  briefcase: Briefcase,
  "shopping-bag": ShoppingBag,
  calendar: CalendarDays,
  utensils: UtensilsCrossed,
  fuel: Fuel,
  mic: Mic,
  plus: Plus,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  users: Users,
};
