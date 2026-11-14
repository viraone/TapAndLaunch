"use client";

import type { CSSProperties } from "react";
import { HeaderClock } from "@/components/pwa-runtime/HeaderClock";
import { ShowClockBar } from "@/components/pwa-runtime/ShowClockBar";
import { RestartShowButton } from "@/components/pwa-runtime/RestartShowButton";
import { TvTimerPanel } from "@/components/pwa-runtime/OpenMicFlatscreenRuntime";
import { CodeStep, EmailStep, LineupList, RequestForm, SignupHeader } from "@/components/pwa-runtime/OpenMicSignupRuntime";
import { CompSetPickerDemo } from "./CompSetPickerDemo";
import { VoiceChatBlockView, type VoicePhase, type VoiceTurn } from "@/components/pwa-runtime/VoiceChatBlock";
import type { ShowClock } from "@/lib/openmic/show-clock";
import type { LineupFeed } from "@/lib/openmic/selection";

const VOICE_PHASES: VoicePhase[] = ["idle", "recording", "thinking", "speaking"];
const VOICE_CONFIG = { title: "Talk in Lao", intro: "Tap the button, speak Lao, and hear the answer in Lao.", greeting: "ສະບາຍດີ! ກົດປຸ່ມແລ້ວເວົ້າພາສາລາວໄດ້ເລີຍ." };
const VOICE_TURNS: VoiceTurn[] = [
  { role: "user", content: "ມື້ນີ້ອາກາດເປັນແນວໃດ?" },
  { role: "assistant", content: "ຂ້ອຍບໍ່ສາມາດເບິ່ງອາກາດໄດ້, ແຕ່ຫວັງວ່າມື້ນີ້ຈະເປັນມື້ທີ່ດີຂອງເຈົ້າ." },
];

// The StageTime app's own colour tokens (copied from the published layout's wrapper), so the pieces look as they do live.
const THEME = {
  "--background": "#09090b",
  "--foreground": "#f4f4f5",
  "--muted": "#18181b",
  "--muted-foreground": "#a1a1aa",
  "--border": "#27272a",
  "--primary": "#f87171",
  "--primary-foreground": "#0a0a0a",
  backgroundColor: "#09090b",
  color: "#f4f4f5",
} as CSSProperties;

const controls = { onStart: () => {}, onStop: () => {}, onReset: () => {}, busy: false };
const running = (remainingMs: number): ShowClock => ({ kind: "running", index: 1, remainingMs, totalMs: 180000, onDeckIndex: 2 });
const idle: ShowClock = { kind: "idle", nextIndex: 2, nextMs: 180000 };
const done: ShowClock = { kind: "idle", nextIndex: -1, nextMs: 0 };

const TV: { label: string; ms: number; running: boolean }[] = [
  { label: "TV: running 1:37", ms: 97000, running: true },
  { label: "TV: 25 s left", ms: 25000, running: true },
  { label: "TV: 8 s left", ms: 8000, running: true },
  { label: "TV: over time", ms: -12000, running: true },
  { label: "TV: on deck, waiting", ms: 180000, running: false },
];

const HOST_ROW_FEED: LineupFeed = { show_date: "2026-11-13", posted: true, me: null, lineup: [{ name: "Nick Cody, Noah Rubin, Viradeth", set_length: "5 min", start_time: "7:00 PM" }, { name: "Karen", set_length: "3 min", start_time: "7:05 PM" }, { name: "Bob", set_length: "3 min", start_time: "7:08 PM" }, { name: "Dana", set_length: "3 min", start_time: "7:11 PM" }] };

const BARS: { label: string; clock: ShowClock; started: boolean }[] = [
  { label: "Host bar: before the show", clock: idle, started: false },
  { label: "Host bar: running 2:41", clock: running(161000), started: true },
  { label: "Host bar: last 10 s", clock: running(8000), started: true },
  { label: "Host bar: over time", clock: running(-15000), started: true },
  { label: "Host bar: between comics", clock: idle, started: true },
  { label: "Host bar: that's the show", clock: done, started: true },
];

export function DevPreview() {
  return (
    <div style={THEME} className="min-h-dvh p-6">
      <p className="mb-6 text-sm text-muted-foreground">Dev preview: fixed states, never shown in production.</p>
      <p className="mb-2 text-sm font-semibold">Header clock (above the avatar)</p>
      <div className="mb-8 inline-flex flex-col items-center gap-1 rounded-xl border p-3">
        <HeaderClock />
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/20 text-[15px] font-semibold text-primary">TJ</span>
        <span className="text-[12px] font-semibold text-muted-foreground">Test</span>
      </div>
      <p className="mb-2 text-sm font-semibold">TV timer panel (46rem wide on the TV)</p>
      <div className="mb-8 flex flex-wrap gap-4">
        {TV.map((t) => (
          <div key={t.label}>
            <p className="mb-1 text-xs text-muted-foreground">{t.label}</p>
            <div className="origin-top-left scale-50" style={{ width: "23rem", height: "26rem" }}>
              <TvTimerPanel name="Evan Hales" next="Sterling Washington" nextLength="3 min" ms={t.ms} totalMs={t.running ? 180000 : t.ms} running={t.running} />
            </div>
          </div>
        ))}
      </div>
      <p className="mb-2 text-sm font-semibold">Host clock bar (phone width)</p>
      <div className="flex flex-wrap gap-4">
        {BARS.map((b) => (
          <div key={b.label}>
            <p className="mb-1 text-xs text-muted-foreground">{b.label}</p>
            {/* A transformed parent makes the bar's fixed position relative to this box, so several can sit on one page. */}
            <div className="relative h-56 w-[22rem] overflow-hidden rounded-2xl border bg-black/40" style={{ transform: "translateZ(0)" }}>
              <ShowClockBar clock={b.clock} started={b.started} controls={controls} />
            </div>
          </div>
        ))}
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Timer tab: admin Restart button (phone width)</p>
      <div className="w-[22rem] rounded-[2rem] bg-[#232323] px-4 pb-5 pt-3 text-white">
        <RestartShowButton busy={false} onRestart={() => {}} />
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Sign-up email card (phone width)</p>
      <div className="w-[22rem] rounded-2xl border bg-background p-4">
        <EmailStep client={null as never} email="" setEmail={() => {}} open onSent={() => {}} />
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Sign-up code screen (phone width)</p>
      <div className="w-[22rem] rounded-2xl border bg-background p-4">
        <CodeStep client={null as never} email="you@example.com" onBack={() => {}} onVerified={() => {}} autoFocus={false} />
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Sign-up request form (phone width)</p>
      <div className="w-[22rem] rounded-2xl border bg-background p-4">
        <RequestForm client={null as never} user={{ id: "preview", email: "you@example.com" } as never} profile={{ stage_name: "", instagram: "", performed_before: null }} onRequested={() => {}} onProfileSaved={() => {}} />
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Lineup with host row</p>
      <SignupHeader config={{} as never} showDate="Friday, Nov 13" open={false} hidePill showStartTime reopenText="" closesAt="" label="Tonight" startsIn="Starts in 2h 10m" />
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Before START (hosts row, Karen on deck)</p>
          <div className="max-w-[430px]">
            <LineupList feed={HOST_ROW_FEED} hostRow onDeckIndex={1} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Hosts on stage</p>
          <div className="max-w-[430px]">
            <LineupList feed={HOST_ROW_FEED} hostRow performingIndex={0} onDeckIndex={1} livePill="4:12" progress={16} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Show running (Karen done, Bob live, Dana waiting)</p>
          <div className="max-w-[430px]">
            <LineupList feed={HOST_ROW_FEED} hostRow performingIndex={2} onDeckIndex={3} livePill="2:10" progress={30} finished={[null, "done", null, null]} />
          </div>
        </div>
      </div>
      <p className="mb-2 mt-8 text-sm font-semibold">Comic set length (Timer tab)</p>
      <div className="flex flex-wrap gap-4">
        <div className="w-[375px] bg-black p-4">
          <CompSetPickerDemo />
        </div>
      </div>

      <p className="mb-2 mt-8 text-sm font-semibold">Voice chat (Lao): idle, listening, thinking, speaking</p>
      <div className="flex flex-wrap gap-4">
        {VOICE_PHASES.map((phase) => (
          <div key={phase} className="w-[375px] rounded-xl border">
            <VoiceChatBlockView config={VOICE_CONFIG} live={false} initial={{ phase, turns: phase === "idle" ? [] : VOICE_TURNS }} />
          </div>
        ))}
      </div>
    </div>
  );
}
