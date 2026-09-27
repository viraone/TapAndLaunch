"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import { Upload } from "lucide-react";

/**
 * A URL input plus an upload button that fills it — not upload-only,
 * because a creator pasting an existing image URL (their own CDN, a stock
 * photo link) is at least as common as uploading a new file, and forcing an
 * upload would mean re-hosting something that already has a perfectly good
 * URL.
 */
export function ImageUploadField({
  id,
  label,
  organizationId,
  value,
  onChange,
}: {
  id: string;
  label: string;
  organizationId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadAppAsset(supabase, organizationId, file);
      onChange(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload image"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-provided/storage URLs
        <img src={value} alt="" className="mt-1 h-20 w-20 rounded-md border object-cover" />
      )}
    </div>
  );
}
