import LegalPageLayout from "../components/LegalPageLayout";

const WhatWeStore = () => (
  <LegalPageLayout
    title="What We Store"
    subtitle="A simple breakdown of the data Finvexa keeps so the product works."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Account data</h2>
      <p>Name, email address, encrypted password, and email verification status.</p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Financial records</h2>
      <p>
        Income entries, expense entries, categories, notes, dates, Tax Pack fields,
        and CSV-imported transactions that you choose to keep.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Files</h2>
      <p>Receipt images or PDFs that you upload for your own record-keeping.</p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Operational telemetry</h2>
      <p>
        Basic page views, important product actions, request IDs, and error reports
        that help us debug issues and monitor reliability.
      </p>
    </section>
  </LegalPageLayout>
);

export default WhatWeStore;
