import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

const MANAGE_LINKS = [
  { path: "analytics", label: "Analytics" },
  { path: "submissions", label: "Submissions" },
  { path: "members", label: "Members" },
  { path: "notifications", label: "Notifications" },
  { path: "products", label: "Products" },
  { path: "orders", label: "Orders" },
  { path: "events", label: "Events" },
  { path: "bookings", label: "Bookings" },
  { path: "gas-stations", label: "Gas stations" },
];

export function AppCard({ app, rootDomain }: { app: AppRow; rootDomain: string }) {
  const previewUrl = `//${app.slug}.${rootDomain}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{app.name}</CardTitle>
        <Badge variant={app.status === "published" ? "default" : "secondary"}>{app.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <a href={previewUrl} target="_blank" rel="noreferrer" className="block text-sm text-muted-foreground underline">
          {app.slug}.{rootDomain}
        </a>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/dashboard/apps/${app.id}/builder`} className="font-medium text-primary underline">
            Open builder
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="sm">
                  Manage <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {MANAGE_LINKS.map((item) => (
                <DropdownMenuItem key={item.path} render={<Link href={`/dashboard/apps/${app.id}/${item.path}`} />}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
