"use client";

import { CompSetLength } from "@/components/pwa-runtime/CompSetLength";

export function CompSetLengthDemo() {
  return (
    <>
      <CompSetLength minutes={null} fallback={3} saving={false} error={null} onChange={() => {}} />
      <CompSetLength minutes={4} fallback={3} saving={false} error={null} onChange={() => {}} />
    </>
  );
}
