import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and conditions — Foxgen AI Store" },
      { name: "description", content: "How ordering, payment checks, delivery and the free rewards programme work at Foxgen AI Store." },
      { property: "og:title", content: "Terms and conditions — Foxgen AI Store" },
      { property: "og:description", content: "Ordering, payment checks, delivery and rewards at Foxgen AI Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms and conditions" updated="10 November 2026">
      <section>
        <h2>Orders and payment</h2>
        <ul>
          <li>Prices shown are the current store prices. The amount on your order is the amount to pay.</li>
          <li>An order is confirmed only after the store owner sees your payment arrive. Typing a payment reference alone does not confirm an order.</li>
          <li>Unpaid orders expire after the time shown at checkout.</li>
        </ul>
      </section>
      <section>
        <h2>Delivery</h2>
        <p>After your payment is confirmed, access details are sent to the delivery email on your order, or in Telegram for bot orders. Each product page lists its own delivery steps and terms.</p>
        <p>We guarantee delivery within 30 minutes after successful payment confirmation, subject to product availability and order verification. If your order is not delivered within 30 minutes, our team will personally contact you and work to complete your delivery as soon as possible.</p>
      </section>
      <section>
        <h2>Refunds and cancellations</h2>
        <p>
          If we are unable to provide the purchased product, you will receive a full refund. An order that arrives late but is delivered and accepted is not refunded. Please contact <Link to="/support" className="text-primary underline">support</Link> if you have questions about an order.
        </p>
      </section>
      <section>
        <h2>Free rewards</h2>
        <ul>
          <li>Invite links unlock after every required task is verified.</li>
          <li>Each verified friend you invite earns 1 credit, once. Self referrals are rejected.</li>
          <li>Credits can be redeemed for FoxGEN Pro licences listed in the rewards hub.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
