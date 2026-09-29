"use client";

import type { OpenMic } from "@/lib/listings/record";
import { SheetModal } from "@/components/pwa-runtime/SheetModal";
import styles from "@/components/pwa-runtime/ListingDirectory.module.css";

/** StageTime's "Sign-up details" window (signupDetailsModal in its index.html):
 * the venue, then the mic's sign-up text. */
export function SignupDetailsModal({ mic, onClose }: { mic: OpenMic; onClose: () => void }) {
  return (
    <SheetModal
      eyebrow={mic.venue || mic.name}
      title={{ visible: "Sign-up details", spoken: "Sign-up details" }}
      closeLabel="Close sign-up details"
      describedBy="signupDetailsText"
      panelClassName={styles.signupPanel}
      onClose={onClose}
    >
      <section className={styles.modalSection}>
        <p id="signupDetailsText" className="m-0 text-sm font-semibold leading-7 text-zinc-100">
          {mic.signupDetails}
        </p>
      </section>
    </SheetModal>
  );
}
