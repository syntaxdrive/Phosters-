import { Link, NavLink, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import {
  getLegalDocument,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
} from '../../data/legalPolicies';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';

export function LegalDocumentPage() {
  const { docSlug } = useParams<{ docSlug?: string }>();
  const { user } = useAuth();
  const activeDoc = getLegalDocument(docSlug);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={user ? '/settings' : '/'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{user ? 'Back to Settings' : 'Back to Home'}</span>
        </Link>

        <Link
          to="/settings"
          className="text-sm font-semibold text-phosters-700 dark:text-phosters-400 hover:underline min-h-[44px] inline-flex items-center"
        >
          App Settings
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-phosters-700 dark:text-phosters-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>Phosters Legal &amp; Policies</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {activeDoc.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
          {activeDoc.summary}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Effective &amp; last updated: {activeDoc.lastUpdated}
        </p>
      </div>

      {/* Policy navigation bar */}
      <nav
        aria-label="Legal documents"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800"
      >
        {LEGAL_DOCUMENTS.map((doc) => {
          const isCurrent = doc.slug === activeDoc.slug;
          return (
            <NavLink
              key={doc.slug}
              to={`/legal/${doc.slug}`}
              className={[
                'inline-flex items-center min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors',
                isCurrent
                  ? 'bg-phosters-50 dark:bg-phosters-900/50 text-phosters-800 dark:text-phosters-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {doc.shortTitle}
            </NavLink>
          );
        })}
      </nav>

      <Card padding="lg" className="space-y-6">
        {activeDoc.sections.map((section) => (
          <section key={section.heading} className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {section.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-phosters-600 dark:text-phosters-400 shrink-0" aria-hidden="true" />
            <span>
              Questions or data requests:{' '}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="font-semibold text-phosters-700 dark:text-phosters-400 hover:underline"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </span>
          </div>
          <span>Phosters Tutorial Centre</span>
        </div>
      </Card>
    </div>
  );
}
