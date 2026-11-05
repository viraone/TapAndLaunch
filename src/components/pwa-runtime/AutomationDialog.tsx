"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A small window over the Automation screen: the contact picker and the "are you sure" questions. It closes on Esc,
 * on the backdrop and on its Cancel-style button, and keeps Tab inside itself while it is open.
 */
export function AutomationDialog({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const returnFocus = document.activeElement;
    const first = panel.current?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"
    );
    first?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"
        ),
      ];
      if (focusable.length === 0) return;
      const last = focusable[focusable.length - 1];
      const firstFocusable = focusable[0];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
      <div
        className="fixed inset-0 bg-black/60"
        onClick={() => onCloseRef.current()}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border bg-background p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
        <div className="mt-2 min-h-0 text-[15px] leading-relaxed text-muted-foreground">
          {children}
        </div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** The "are you sure" window: one sentence, Cancel, and the button that does it. */
export function AutomationConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AutomationDialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border bg-muted px-4 text-base font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-11 rounded-xl px-4 text-base font-bold transition disabled:opacity-50 ${
              tone === "danger" ? "bg-red-600 text-white" : "bg-primary text-primary-foreground"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </AutomationDialog>
  );
}
