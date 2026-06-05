import LegalPageLayout from "../components/LegalPageLayout";

const TermsPage = () => (
  <LegalPageLayout
    title="Terms of Use"
    subtitle="The core terms for using Munmai responsibly."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">About Munmai</h2>
      <p>
        Munmai is a personal finance organization app for tracking income,
        expenses, receipts, imports, shared expenses, balances, settlements, and
        reports.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Use at your own judgment
      </h2>
      <p>
        Munmai helps you organize and understand your financial records, but it
        does not replace professional tax, legal, accounting, investment, or
        financial advice.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Your responsibilities
      </h2>
      <p>
        You are responsible for entering accurate information, reviewing
        imported transactions, verifying receipt details, keeping your login
        credentials secure, and using Munmai lawfully.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Uploaded files</h2>
      <p>
        You may upload receipts, PDFs, CSVs, and related files for your own
        record-keeping. You are responsible for making sure you have the right
        to upload and store those files.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Imports and duplicate detection
      </h2>
      <p>
        Munmai may help detect duplicate imported records and may allow archive
        or revert actions for supported imports. You are still responsible for
        reviewing imported information before relying on it.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        No professional advice
      </h2>
      <p>
        Reports, summaries, categories, Tax Pack-style views, and receipt
        organization features are provided for convenience only. Always verify
        important financial or tax information before using it for official
        purposes.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Service changes</h2>
      <p>
        Munmai may change, improve, or remove features over time. During
        development and demo stages, some features may be incomplete,
        experimental, or subject to change.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Acceptable use</h2>
      <p>
        Do not misuse Munmai, upload malicious files, attempt to access another
        user's data, interfere with the service, or use the app unlawfully.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Limitation</h2>
      <p>
        Munmai is provided as a software tool. To the maximum extent allowed by
        law, Munmai is not responsible for losses caused by incorrect user
        input, import errors, missing receipts, inaccurate reports, service
        interruptions, or reliance on app summaries.
      </p>
    </section>
  </LegalPageLayout>
);

export default TermsPage;
