"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import { Upload } from "lucide-react";

/** What the Files block accepts: documents, slides, sheets, pictures, audio and video, zips. */
export const FILE_ACCEPT = ".pdf,.doc,.docx,.pages,.odt,.rtf,.txt,.md,.ppt,.pptx,.key,.odp,.xls,.xlsx,.numbers,.csv,.ods,.zip,image/*,audio/*,video/*";

/** The bucket accepts files up to this size; bigger ones are refused before any upload starts. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Like `ImageUploadField` but for any file: a URL input plus an upload button that fills it. The upload keeps the
 * file's extension (so a PDF opens as a PDF) and hands the original name back through `onChange`, so an editor can
 * suggest a label from it.
 */
export function FileUploadField({
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
  onChange: (url: string, fileName?: string) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("That file is over 50 MB. Try a smaller one.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAppAsset(supabase, organizationId, file);
      onChange(url, file.name);
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
          aria-label="Upload file"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} className="hidden" onChange={handleFileSelected} />
      </div>
      {uploading && <p className="text-xs text-neutral-400">Uploading…</p>}
    </div>
  );
}
