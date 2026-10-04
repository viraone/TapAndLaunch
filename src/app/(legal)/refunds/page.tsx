import type { Metadata } from "next";
import { Doc, List, Section } from "@/components/legal/Doc";
import { BRAND, LEGAL_UPDATED, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: `Refund Policy · ${BRAND}` };

export default function RefundsPage() {
  return (
    <Doc
      title="Refund Policy"
      updated={LEGAL_UPDATED}
      intro={`Who refunds what depends on what you bought. Here is how it works for ${BRAND} and for the apps people build with it.`}
    >
      <Section title="If you bought something in someone's app">
        <p>
          The business that built the app is the seller. {BRAND} is the software they use, and your payment goes to that business, not to us.
          So refunds, returns and complaints about a purchase are handled by that business.
        </p>
        <List>
          <li>Contact the business first. Your Stripe receipt shows how to reach them.</li>
          <li>If they cannot resolve it, you can ask your card issuer or bank about a dispute.</li>
          <li>{BRAND} cannot refund these payments because we never receive the money.</li>
        </List>
      </Section>
      <Section title="If you run an app and need to refund a customer">
        <p>
          Refunds on card payments are made from your own Stripe dashboard. When a payment is fully refunded, the order shows as
          &quot;Refunded&quot; in your {BRAND} dashboard.
        </p>
      </Section>
      <Section title={`Our own charges`}>
        <p>
          We do not currently charge for {BRAND}. If we introduce paid plans, the refund terms will be shown clearly before you pay.
        </p>
      </Section>
      <Section title="Questions">
        <p>
          Email {SUPPORT_EMAIL}. We will point you in the right direction, even when the refund is the business&apos;s to give.
        </p>
      </Section>
    </Doc>
  );
}
