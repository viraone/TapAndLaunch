import type { Metadata } from "next";
import { pageMetadata } from "@/lib/marketing";
import { Doc, List, Section } from "@/components/legal/Doc";
import { BRAND, LEGAL_NAME, LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service | TapAndLaunch",
  description: "The terms of service for TapAndLaunch: your account, your apps and content, payments, and what we each agree to when you build with us.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <Doc
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro={`These terms are the agreement between you and ${LEGAL_NAME}, doing business as ${BRAND} ("${BRAND}", "we", "us"), a sole proprietorship in Seattle, Washington. By creating an account or using ${BRAND}, you agree to them.`}
    >
      <Section title="1. What TapAndLaunch is">
        <p>
          {BRAND} lets you build, publish and manage installable web apps without writing code. Depending on what you set up, an app can
          include pages, forms, member sign-ups, push, email and text messages, events and bookings, a product list with orders, and card
          payments through Stripe.
        </p>
      </Section>
      <Section title="2. Your account">
        <List>
          <li>You must be at least 18 and able to enter a binding agreement, and you must be allowed to act for any business you set up.</li>
          <li>Give accurate information, keep your password private, and tell us if you think someone else has used your account.</li>
          <li>You are responsible for everything that happens under your account, including what other people you add can do.</li>
        </List>
      </Section>
      <Section title="3. Your content and your customers">
        <p>
          You own the content you put into your apps. You give us permission to store, process and display it only as needed to run{" "}
          {BRAND} for you. You are responsible for your content and for how you use the information of the people who use your app.
        </p>
        <p>
          If you send push, email or text messages, you are responsible for having the permission the law requires and for following laws
          such as CAN-SPAM and the Telephone Consumer Protection Act.
        </p>
      </Section>
      <Section title="4. What you may not do">
        <List>
          <li>Break the law, or use {BRAND} for fraud, harassment, spam or to spread malware.</li>
          <li>Post content that infringes someone else&apos;s rights, or sell goods or services that are illegal or that Stripe does not allow.</li>
          <li>Try to break, overload or get around the security of {BRAND} or other people&apos;s apps.</li>
        </List>
        <p>We may remove content or suspend an app or account that breaks these rules.</p>
      </Section>
      <Section title="5. Payments">
        <p>
          Card payments are processed by Stripe. To take payments, you connect your own Stripe account and agree to Stripe&apos;s own terms. The
          money your customers pay goes to your Stripe account, not to us.
        </p>
        <p>
          You are the seller. You are responsible for your prices, taxes, delivery, customer service, refunds and chargebacks. {BRAND} is
          software; we are not a party to your sales and we do not hold your funds. If a product has no Stripe connection, an order is only a
          request that you follow up on yourself.
        </p>
      </Section>
      <Section title="6. Fees">
        <p>
          We do not currently charge a fee on payments made in your apps; Stripe&apos;s own fees apply to your Stripe account. We may introduce
          paid plans or fees in the future. We will tell you before any charge begins, and you can stop using {BRAND} instead.
        </p>
      </Section>
      <Section title="7. Other services we rely on">
        <p>
          {BRAND} depends on services from other companies, such as Stripe, Supabase, Vercel, Resend, Twilio and Google. Their terms also apply
          to the parts of the service they provide, and an outage at one of them can affect {BRAND}.
        </p>
      </Section>
      <Section title="8. The service as it is">
        <p>
          {BRAND} is an early product. We work to keep it available and secure, but we provide it &quot;as is&quot; and &quot;as available&quot;,
          without promises that it will be uninterrupted or error-free. We may change or remove features.
        </p>
      </Section>
      <Section title="9. Ending your use">
        <p>
          You may stop using {BRAND} at any time and ask us to delete your account. We may suspend or end your access if you break these terms
          or put others at risk. Email {SUPPORT_EMAIL} to ask for deletion.
        </p>
      </Section>
      <Section title="10. Limits on our responsibility">
        <p>
          To the fullest extent the law allows, {BRAND} is not liable for indirect, incidental or consequential losses, such as lost profits or
          lost data. Our total responsibility to you for any claim is limited to the greater of what you paid us in the 12 months before the
          claim or $100. Some places do not allow these limits, so they may not apply to you in full.
        </p>
      </Section>
      <Section title="11. Washington law">
        <p>These terms are governed by the laws of the State of Washington. Disputes will be handled in the courts located in King County, Washington.</p>
      </Section>
      <Section title="12. Changes to these terms">
        <p>
          We may update these terms. When we make a significant change we will tell account holders by email or in the dashboard. Using{" "}
          {BRAND} after a change means you accept it.
        </p>
      </Section>
    </Doc>
  );
}
