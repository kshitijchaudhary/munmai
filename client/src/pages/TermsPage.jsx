import LegalPageLayout from "../components/LegalPageLayout";

const TermsPage = () => (
  <LegalPageLayout
    title="Terms of Use"
    subtitle="The core terms for using Finvexa responsibly."
  >
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Use at your own judgment</h2>
      <p>
        Finvexa helps you organize and understand your finances, but it does not
        replace licensed tax, legal, or financial advice.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Account security</h2>
      <p>
        You are responsible for keeping your login credentials secure and for
        reviewing the information you import or upload.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Acceptable use</h2>
      <p>
        Do not abuse the service, upload malicious files, or attempt to interfere
        with other accounts, infrastructure, or data.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Service changes</h2>
      <p>
        We may improve, change, or remove features over time. We will aim to keep
        core data export available so you retain portability.
      </p>
    </section>
  </LegalPageLayout>
);

export default TermsPage;
