import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f9fbf8] text-[#02575c] p-6 lg:p-12 font-sans selection:bg-[#daf4d7]">
      <div className="max-w-4xl mx-auto bg-white p-8 lg:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <h1 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-[#00747B]">Privacy Policy</h1>
        <p className="text-gray-500 font-medium mb-8">Last Updated: March 13, 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed font-medium">
          <p>Welcome to instabill.shop. This Privacy Policy explains how instabill.shop collects, uses, stores, and protects user information when you access or use our billing and shop management platform.</p>
          <p>By using instabill.shop, you agree to the collection and use of information in accordance with this Privacy Policy.</p>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">1. About instabill.shop</h2>
            <p>instabill.shop provides a digital billing and shop management platform that allows businesses to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>Create invoices and bills</li>
              <li>Manage product listings</li>
              <li>Record sales transactions</li>
              <li>Maintain billing records for their shops</li>
            </ul>
            <p>The platform is designed to assist businesses in maintaining digital billing records.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">2. Information We Collect</h2>
            
            <h3 className="font-bold text-[#02575c] mb-2 mt-4">Account Information</h3>
            <p>When users register for instabill.shop, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>Name</li>
              <li>Phone number</li>
              <li>Email address (if provided)</li>
              <li>Shop name</li>
              <li>Login credentials</li>
            </ul>
            <p>This information is used to create and manage user accounts.</p>

            <h3 className="font-bold text-[#02575c] mb-2 mt-4">Shop Data</h3>
            <p>Users may voluntarily store business data on the platform, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>Product lists</li>
              <li>Product prices</li>
              <li>Sales records</li>
              <li>Customer billing information</li>
              <li>Invoice details</li>
            </ul>
            <p>This information is stored to provide billing and shop management functionality.</p>

            <h3 className="font-bold text-[#02575c] mb-2 mt-4">Payment Information</h3>
            <p>Subscription payments may be processed through third-party payment gateways.</p>
            <p>instabill.shop does not store full payment card information.</p>
            <p>Payment details such as card numbers or banking details are handled securely by the payment gateway provider.</p>

            <h3 className="font-bold text-[#02575c] mb-2 mt-4">Usage Information</h3>
            <p>We may collect limited technical data automatically when users access the platform, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>device information</li>
              <li>browser type</li>
              <li>IP address</li>
              <li>login timestamps</li>
            </ul>
            <p>This information helps improve system security and service performance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">3. How We Use Information</h2>
            <p>The information we collect may be used for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>to provide and maintain the instabill.shop platform</li>
              <li>to create and manage user accounts</li>
              <li>to process subscription payments</li>
              <li>to provide customer support</li>
              <li>to improve platform performance and functionality</li>
              <li>to maintain system security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">4. Data Ownership</h2>
            <p>Users retain ownership of the data they enter into instabill.shop.</p>
            <p className="mt-2">Users are responsible for ensuring the accuracy of:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>product information</li>
              <li>pricing details</li>
              <li>billing records</li>
            </ul>
            <p>instabill.shop does not verify the accuracy of business data entered by users.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">5. Data Sharing</h2>
            <p>instabill.shop does not sell or rent user data.</p>
            <p className="mt-2">User information may only be shared in the following situations:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>with payment gateway providers for processing payments</li>
              <li>with service providers necessary for platform operation</li>
              <li>if required by applicable law or legal authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">6. Data Security</h2>
            <p>We implement reasonable security measures to protect user data from unauthorized access, misuse, or disclosure.</p>
            <p>However, no internet-based service can guarantee complete security. Users acknowledge that they use the platform at their own risk.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">7. Data Retention</h2>
            <p>User data may be retained as long as the account remains active or as required for operational, legal, or security purposes.</p>
            <p>Users may request account deletion through the platform support channels.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">8. User Responsibilities</h2>
            <p>Users are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2 mb-2">
              <li>protecting their account login credentials</li>
              <li>ensuring the accuracy of shop and billing data</li>
              <li>maintaining appropriate backups if required</li>
            </ul>
            <p>instabill.shop is not responsible for losses resulting from incorrect or incomplete data entered by users.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">9. Third-Party Services</h2>
            <p>instabill.shop may rely on third-party services such as payment processors and infrastructure providers.</p>
            <p>These services operate under their own privacy policies and terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">10. Children's Privacy</h2>
            <p>The instabill.shop platform is intended for use by businesses and individuals who are legally capable of entering into contracts.</p>
            <p>The platform is not intended for use by individuals under the age of 18.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">11. Changes to Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time.</p>
            <p>Users will be notified of significant updates through the platform or website.</p>
            <p>Continued use of the platform after updates indicates acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#02575c] mb-3">12. Contact</h2>
            <p>If you have questions about this Privacy Policy, you may contact us through the support or contact information provided on the instabill.shop website.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
