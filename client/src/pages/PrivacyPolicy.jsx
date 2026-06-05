import LegalPageLayout from "../components/LegalPageLayout";

const PrivacyPolicy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    subtitle="A plain-language summary of how Munmai handles your data."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">What we collect</h2>
      <p>
        Munmai stores the information you provide so the app can help you
        organize your personal finances. This may include your account details,
        income records, expense records, receipt files, uploaded statement data,
        import history, group and shared expense information, categories, notes,
        tags, and report-related summaries.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">How we use it</h2>
      <p>
        We use your data to provide Munmai features such as transaction
        tracking, receipt storage, CSV/PDF imports, duplicate detection, import
        history, shared expense tracking, monthly summaries, and Tax Pack-style
        organization.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Receipt and statement files
      </h2>
      <p>
        Receipts and statements may contain personal or financial information.
        Munmai stores these files only so you can review, organize, and manage
        your records. Files are accessed through protected routes and are not
        intended to be publicly available.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        What we do not do
      </h2>
      <p>
        Munmai does not sell your personal finance data. Munmai does not use
        your transaction history or receipt content for advertising.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Your controls</h2>
      <p>
        You can create, edit, delete, archive, or revert supported records
        inside the app where those features are available. For account-level
        data requests, contact the Munmai Administrator.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Security</h2>
      <p>
        Munmai uses authentication, user-specific access checks, protected API
        routes, and restricted file access to help protect your data. Munmai
        uses safeguards to protect your data, but no online service can be
        completely risk-free. You should keep your login credentials secure and
        contact the Munmai Administrator if you notice anything unusual.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Important note</h2>
      <p>
        Munmai is a personal finance organization tool. It is not a bank,
        accounting firm, tax filing service, legal advisor, or financial
        advisor.
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
