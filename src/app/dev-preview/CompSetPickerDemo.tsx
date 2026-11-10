"use client";

import { CompSetPicker, type CompTarget } from "@/components/pwa-runtime/CompSetPicker";

const TARGETS: CompTarget[] = [
  { key: "karen young", name: "Karen Young", minutes: 3, custom: false },
  { key: "evan hales", name: "Evan Hales", minutes: 3, custom: false },
  { key: "test jones 1", name: "Test Jones 1", minutes: 7, custom: true },
];

const none = () => {};

/** The Timer tab's set-length card in its three states: the sheet's numbers, one comic picked with their own number, and one number for everyone. */
export function CompSetPickerDemo() {
  return (
    <>
      <CompSetPicker targets={TARGETS} selected="" onSelect={none} allMinutes={null} fallback={3} hasOverrides={true} saving={false} error={null} onChange={none} />
      <CompSetPicker targets={TARGETS} selected="test jones 1" onSelect={none} allMinutes={null} fallback={3} hasOverrides={true} saving={false} error={null} onChange={none} />
      <CompSetPicker targets={TARGETS} selected="" onSelect={none} allMinutes={4} fallback={3} hasOverrides={true} saving={false} error={null} onChange={none} />
    </>
  );
}
