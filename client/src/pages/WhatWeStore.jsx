import LegalPageLayout from "../components/LegalPageLayout";

const WhatWeStore = () => (
  <LegalPageLayout
    title="What Munmai Stores"
    subtitle="A simple breakdown of the data Munmai keeps so the product works."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Account data</h2>
      <p>
        Munmai stores account information such as your name, email address,
        password hash, and authentication-related metadata. Munmai does not
        store plain-text passwords.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Financial records
      </h2>
      <p>
        Munmai stores income records, expense records, dates, amounts,
        categories, vendors, notes, receipt references, and user-specific
        financial metadata.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Receipt files</h2>
      <p>
        Munmai may store receipt images or PDFs that you upload, along with
        receipt details such as vendor, amount, purchase date, category, notes,
        tags, file type, and upload date.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Statement import data
      </h2>
      <p>
        Munmai may store CSV/PDF import batches, import rows, duplicate
        fingerprints, import summaries, archive status, and revert status. This
        helps you review imports, avoid duplicates, and undo accidental
        confirmed imports where supported.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Groups and shared expenses
      </h2>
      <p>
        Munmai may store group records, group members, shared expenses,
        balances, settlements, invitations, and join-code-related data.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Reports and summaries
      </h2>
      <p>
        Munmai may calculate monthly summaries, dashboard totals, category
        breakdowns, receipt coverage, and Tax Pack-style summaries based on the
        records you enter or import.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        What Munmai does not currently do
      </h2>
      <p>
        Munmai does not currently connect directly to bank accounts,
        automatically file taxes, provide professional financial advice, or
        perform OCR/AI extraction in the Receipt Inbox MVP.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Important note</h2>
      <p>
        Munmai is designed for personal organization and portfolio/demo use.
        Users should verify important records before relying on them for tax,
        legal, accounting, or financial decisions.
      </p>
    </section>
  </LegalPageLayout>
);

export default WhatWeStore;
