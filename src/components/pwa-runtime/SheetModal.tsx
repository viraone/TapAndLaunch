"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

const CLOSE_MS = 180;

/** StageTime's pop-up window (trip-intel-modal in its style.css): centred on a
 * wide screen, a sheet from the bottom on a phone. It fades in, keeps Tab
 * inside itself, and closes on Esc, the backdrop or its Close button, handing
 * focus back to whatever opened it. */
export function SheetModal({
  eyebrow,
  title,
  closeLabel,
  describedBy,
  panelClassName = "",
  footer,
  onClose,
  children,
}: {
  /** The venue: the first, brighter part of the eyebrow line. */
  eyebrow: string;
  /** The rest of the eyebrow line, and the window's name for screen readers. */
  title: { visible: string; spoken: string };
  closeLabel: string;
  describedBy?: string;
  panelClassName?: string;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  function close() {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onCloseRef.current(), reduced ? 0 : CLOSE_MS);
  }

  useEffect(() => {
    const returnFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      setOpen(true);
      closeButton.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className={`${styles.modal} ${open ? styles.modalOpen : ""}`}>
      <div className={styles.modalBackdrop} onClick={close} aria-hidden="true" />
      <section
        ref={panel}
        className={`${styles.modalPanel} ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
      >
        <header className={styles.modalHeader}>
          <div className="min-w-0">
            <p className={styles.modalEyebrow}>
              <span className={styles.modalVenue}>{eyebrow}</span>
              <span aria-hidden="true">•</span> {title.visible}
            </p>
            <h2 id={titleId} className="sr-only">
              {title.spoken}
            </h2>
          </div>
          <button ref={closeButton} type="button" className={styles.modalClose} aria-label={closeLabel} onClick={close}>
            ✕ <span>Close</span>
          </button>
        </header>
        <div className={styles.modalContent}>{children}</div>
        {footer}
      </section>
    </div>
  );
}
