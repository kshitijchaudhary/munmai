import LegalPageLayout from "../components/LegalPageLayout";

const PrivacyPolicy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    subtitle="A plain-language summary of how Munmai handles your data."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">What we collect</h2>
      <p>
        We store the account details you give us, the transactions and receipts you
        upload, and basic product telemetry used to keep the app reliable.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">How we use it</h2>
      <p>
        Your data is used to provide budgeting, receipt storage, Tax Pack exports,
        CSV imports, and account security features like email verification.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">What we do not do</h2>
      <p>
        We do not sell your personal finance data. We do not use your transaction
        history for ads.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Your controls</h2>
      <p>
        You can export your data and permanently delete your account from inside the
        app. Deleting your account also removes stored transaction records and
        receipts associated with it.
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
