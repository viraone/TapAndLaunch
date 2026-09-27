import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

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
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link href={`/dashboard/apps/${app.id}/builder`} className="font-medium text-primary underline">
            Open builder
          </Link>
          <Link href={`/dashboard/apps/${app.id}/analytics`} className="text-muted-foreground underline">
            Analytics
          </Link>
          <Link href={`/dashboard/apps/${app.id}/submissions`} className="text-muted-foreground underline">
            Submissions
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
