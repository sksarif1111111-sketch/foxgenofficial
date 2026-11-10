import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Foxgen AI Store" },
      { name: "description", content: "What information Foxgen AI Store collects when you order or use the Telegram rewards bot, and how it is used." },
      { property: "og:title", content: "Privacy policy — Foxgen AI Store" },
      { property: "og:description", content: "What we collect, why, and how to contact us about your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="10 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your Telegram user ID, username and first name when you start our Telegram bot.</li>
          <li>The delivery email address you enter for an order.</li>
          <li>Order details: products, quantity, the payment method you chose and the payment reference you submit.</li>
          <li>Rewards activity: completed tasks, referrals and credit history.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To check your payment, deliver your order and contact you about it.</li>
          <li>To run the rewards programme, including verifying tasks and awarding referral credits.</li>
          <li>To prevent abuse such as self referrals.</li>
        </ul>
      </section>
      <section>
        <h2>Payments</h2>
        <p>We do not store card numbers. Payments are made directly through the method you choose (for example crypto, Binance, UPI or Telegram Stars) and are checked by the store owner.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          For questions about your information, reach us through the channels on our <Link to="/support" className="text-primary underline">support page</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
