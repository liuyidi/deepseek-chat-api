import { useEffect, useMemo, useState } from "react";

import "./legal-page.css";
import { getLegalDocument, type LegalDocumentId, type LegalLanguage } from "./legal-content";

export type LegalPageProps = {
  documentId: LegalDocumentId;
};

function resolveInitialLanguage(): LegalLanguage {
  try {
    const stored = window.localStorage?.getItem("mini-auth.legal.locale");
    if (stored === "zh" || stored === "en") {
      return stored;
    }
  } catch {
    // Ignore unavailable storage in non-browser test environments.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function LegalPage({ documentId }: LegalPageProps) {
  const [language, setLanguage] = useState<LegalLanguage>(resolveInitialLanguage);
  const documentContent = useMemo(() => getLegalDocument(documentId, language), [documentId, language]);

  useEffect(() => {
    document.title = `${documentContent.title} · Mini Auth`;
    try {
      window.localStorage?.setItem("mini-auth.legal.locale", language);
    } catch {
      // Ignore unavailable storage in non-browser test environments.
    }
  }, [documentContent.title, language]);

  const otherDocument = documentId === "privacy" ? "terms" : "privacy";

  return (
    <main className="legal-page">
      <header className="legal-header">
        <a className="legal-brand" href="/" aria-label="Mini Auth">
          Mini Auth
        </a>
        <div className="legal-header-actions">
          <button
            type="button"
            className={`legal-lang-button${language === "zh" ? " is-active" : ""}`}
            aria-pressed={language === "zh"}
            onClick={() => setLanguage("zh")}
          >
            中文
          </button>
          <button
            type="button"
            className={`legal-lang-button${language === "en" ? " is-active" : ""}`}
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
        </div>
      </header>

      <article className="legal-panel">
        <p className="legal-updated">{language === "zh" ? "更新日期" : "Last updated"}：{documentContent.updatedAt}</p>
        <h1>{documentContent.title}</h1>
        <p className="legal-intro">{documentContent.intro}</p>

        {documentContent.sections.map((section) => (
          <section key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <footer className="legal-footer">
          <a href={`/${otherDocument}`}>
            {language === "zh"
              ? otherDocument === "privacy"
                ? "查看隐私政策"
                : "查看服务条款"
              : otherDocument === "privacy"
                ? "Privacy Policy"
                : "Terms of Service"}
          </a>
          <a href="/login">{language === "zh" ? "返回登录" : "Back to sign in"}</a>
        </footer>
      </article>
    </main>
  );
}
