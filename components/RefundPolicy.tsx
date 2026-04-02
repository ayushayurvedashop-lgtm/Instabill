import React from 'react';

const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f9fbf8] text-[#02575c] p-6 lg:p-12 font-sans selection:bg-[#daf4d7]">
      <div className="max-w-4xl mx-auto bg-white p-8 lg:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <h1 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-[#00747B]">Refund and Cancellation Policy</h1>
        <p className="text-gray-500 font-medium mb-8">Last Updated: March 13, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed font-medium">
          <p>This Refund and Cancellation Policy describes the terms related to subscription payments for instabill.shop.</p>
          <p>By purchasing a subscription to instabill.shop, you agree to this policy.</p>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">1. Subscription Services</h2>
            <p>instabill.shop provides access to a digital billing and shop management platform through subscription-based plans.</p>
            <p>When a user purchases a subscription, they receive access to the platform and its features for the duration of the selected subscription period.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">2. No Refund Policy</h2>
            <p>All payments made for subscriptions to instabill.shop are final and non-refundable.</p>
            <p className="mt-2">Once a subscription payment has been successfully processed, refunds will not be issued under any circumstances, including but not limited to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>partial use of the subscription period</li>
              <li>non-use of the platform</li>
              <li>change of business decisions</li>
              <li>accidental purchases</li>
              <li>misunderstanding of features</li>
            </ul>
            <p>Users are encouraged to review the platform features before purchasing a subscription.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">3. Subscription Cancellation</h2>
            <p>Users may choose to cancel their subscription at any time.</p>
            <p className="mt-2">However:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>Cancellation will stop future subscription renewals.</li>
              <li>The current subscription will remain active until the end of the billing period.</li>
              <li>No partial refunds will be provided for unused time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">4. Service Suspension</h2>
            <p>instabill.shop reserves the right to suspend or terminate accounts if users:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>violate the Terms and Conditions</li>
              <li>misuse the platform</li>
              <li>engage in fraudulent activities</li>
            </ul>
            <p>In such cases, no refunds will be issued.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">5. Payment Gateway Processing</h2>
            <p>Payments for subscriptions are processed through secure third-party payment gateways.</p>
            <p>instabill.shop does not store sensitive payment information such as credit card or debit card numbers.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">6. Policy Updates</h2>
            <p>instabill.shop may update this Refund and Cancellation Policy from time to time.</p>
            <p>Users are encouraged to review this policy periodically.</p>
            <p>Continued use of the platform after updates indicates acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">7. Contact</h2>
            <p>For any questions related to this policy, users may contact support through the official contact channels provided on the instabill.shop website.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
