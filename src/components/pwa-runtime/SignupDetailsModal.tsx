"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenMic } from "@/lib/listings/record";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

const CLOSE_MS = 180;

/** StageTime's "Sign-up details" window (signupDetailsModal in its
 * index.html): the venue, then the mic's sign-up text. Esc, the backdrop and
 * Close all close it, and focus goes back to the button that opened it. */
export function SignupDetailsModal({ mic, onClose }: { mic: OpenMic; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const closing = useRef(false);

  function close() {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduced ? 0 : CLOSE_MS);
  }

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      setOpen(true);
      closeButton.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className={`${styles.modal} ${open ? styles.modalOpen : ""}`}>
      <div className={styles.modalBackdrop} onClick={close} aria-hidden="true" />
      <section
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signupDetailsTitle"
        aria-describedby="signupDetailsText"
      >
        <header className={styles.modalHeader}>
          <div className="min-w-0">
            <p className={styles.modalEyebrow}>
              <span className={styles.modalVenue}>{mic.venue || mic.name}</span>
              <span aria-hidden="true">•</span> Sign-up details
            </p>
            <h2 id="signupDetailsTitle" className="sr-only">
              Sign-up details
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className={styles.modalClose}
            aria-label="Close sign-up details"
            onClick={close}
          >
            ✕ <span>Close</span>
          </button>
        </header>
        <div className={styles.modalContent}>
          <section className={styles.modalSection}>
            <p id="signupDetailsText" className="m-0 text-sm font-semibold leading-7 text-zinc-100">
              {mic.signupDetails}
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
