import type { Metadata } from "next";
import { pageMetadata } from "@/lib/marketing";
import { Doc, List, Section } from "@/components/legal/Doc";
import { BRAND, LEGAL_NAME, LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy: how TapAndLaunch uses your data",
  description: "How TapAndLaunch collects, uses and protects information about you and the people who use the apps you build, and the choices you have.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <Doc
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro={`This policy explains what ${LEGAL_NAME}, doing business as ${BRAND}, collects, why, and who can see it. It covers people who build apps with ${BRAND} and people who use the apps they build.`}
    >
      <Section title="What we collect">
        <p>
          <strong className="text-neutral-100">If you build apps with us:</strong>
        </p>
        <List>
          <li>Your email address and password. Passwords are stored in a scrambled (hashed) form, not as plain text.</li>
          <li>Your organization, your apps and everything you put in them: pages, images, settings and products.</li>
          <li>Usage counts for your apps, such as views, installs and orders.</li>
          <li>Payment setup information through Stripe (see &quot;Payments&quot; below).</li>
        </List>
        <p>
          <strong className="text-neutral-100">If you use an app someone built with us</strong>, the app&apos;s owner decides what to ask for. Depending
          on the app, that can include:
        </p>
        <List>
          <li>Your name, email address, phone number (optional) and a password for the app.</li>
          <li>Forms you submit, bookings you make and orders you place (name, email, items and total).</li>
          <li>A push notification address for your browser if you choose &quot;Enable notifications&quot;.</li>
          <li>Your approximate location, only for features that ask your browser for it, such as finding nearby places.</li>
        </List>
        <p>
          <strong className="text-neutral-100">Automatically:</strong> like most websites, our servers log your IP address, browser type and the
          pages you request, to keep the service running and secure.
        </p>
      </Section>
      <Section title="Payments">
        <p>
          Card payments are handled by Stripe. Your card number is entered on Stripe&apos;s page and never reaches {BRAND}. We keep the order
          details (items, total, name, email) and Stripe&apos;s reference numbers so the app owner can see and manage the order.
        </p>
      </Section>
      <Section title="How we use information">
        <List>
          <li>To run {BRAND}: sign you in, show your apps, and deliver what an app&apos;s owner has set up.</li>
          <li>To send messages: sign-in codes, order and account emails, and push, email or text messages that an app owner chooses to send.</li>
          <li>To keep things safe, fix problems and understand how the product is used.</li>
        </List>
        <p>We do not sell your personal information, and we do not show advertising.</p>
      </Section>
      <Section title="Who we share it with">
        <p>Only with the companies that help us run the service, and only for that purpose:</p>
        <List>
          <li>Supabase (our database and sign-in), Vercel (hosting), Stripe (payments).</li>
          <li>Resend (email), Twilio (text messages, when an app owner uses them), Google Maps (place and map features), and browser push services.</li>
          <li>The owner of an app you use, who can see the information you give that app.</li>
          <li>Authorities, if the law requires it.</li>
        </List>
      </Section>
      <Section title="Cookies">
        <p>
          We use cookies to keep you signed in and to remember choices such as your active organization. We do not use advertising or
          cross-site tracking cookies.
        </p>
      </Section>
      <Section title="How long we keep it">
        <p>
          We keep information while your account or the app you use is active. If you ask us to delete your account, we will delete or
          anonymize your information, except what we must keep for legal or payment-record reasons.
        </p>
      </Section>
      <Section title="Your choices">
        <p>
          You can ask to see, correct or delete your information by emailing {SUPPORT_EMAIL}. If you are a customer of someone&apos;s app, that
          business decides how your information is used, so you may also need to contact them. You can turn push notifications off at any time
          from the app or your browser settings.
        </p>
      </Section>
      <Section title="Security">
        <p>
          We protect information with access controls, encryption in transit and trusted providers. No online service is perfectly secure, and
          we cannot promise absolute security.
        </p>
      </Section>
      <Section title="Children">
        <p>{BRAND} is not meant for children under 13, and we do not knowingly collect their information.</p>
      </Section>
      <Section title="Changes">
        <p>If we change this policy in a meaningful way, we will update the date above and, where we can, tell account holders.</p>
      </Section>
    </Doc>
  );
}
