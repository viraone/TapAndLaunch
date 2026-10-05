import type { Metadata } from "next";
import { pageMetadata } from "@/lib/marketing";
import Link from "next/link";
import { Doc, List, Section } from "@/components/legal/Doc";
import { BRAND, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Support and Contact | TapAndLaunch",
  description: "Get help with TapAndLaunch: how to reach support, what to include in your message, and how quickly we reply.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <Doc title="Support" intro={`Need help with ${BRAND}? Email us and a person will reply.`}>
      <Section title="Contact us">
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lg font-medium text-neutral-50 underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>We aim to reply within a few business days. Please include:</p>
        <List>
          <li>The email address on your account.</li>
          <li>The name or address of your app, if it is about an app.</li>
          <li>What you expected, what happened instead, and a screenshot if you can.</li>
        </List>
      </Section>
      <Section title="Common questions">
        <List>
          <li>
            <strong className="text-neutral-100">Taking card payments:</strong> in your dashboard, open Settings, then Payments, and choose
            Connect Stripe.
          </li>
          <li>
            <strong className="text-neutral-100">Bought something in an app?</strong> Contact the business that built it. See our{" "}
            <Link href="/refunds" className="underline underline-offset-4">
              refund policy
            </Link>
            .
          </li>
          <li>
            <strong className="text-neutral-100">Your information:</strong> see the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>{" "}
            or email us to ask for access or deletion.
          </li>
        </List>
      </Section>
    </Doc>
  );
}
