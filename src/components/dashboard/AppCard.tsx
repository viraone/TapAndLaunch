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
        <Link
          href={`/dashboard/apps/${app.id}/builder`}
          className="inline-block text-sm font-medium text-primary underline"
        >
          Open builder
        </Link>
      </CardContent>
    </Card>
  );
}
