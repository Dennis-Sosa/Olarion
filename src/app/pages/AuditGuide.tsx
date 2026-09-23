import { Link, useSearchParams } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Archive,
  Download,
  FileText,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import { AUDIT_GUIDE, AUDIT_TASK_TEMPLATE } from "../../data/auditGuide";

export function AuditGuide() {
  const [params, setParams] = useSearchParams();
  const language = params.get("lang") === "zh" ? "zh" : "en";
  const copy = AUDIT_GUIDE[language];
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-white to-slate-50/40">
      <Navigation />
      <main
        lang={language === "zh" ? "zh-CN" : "en"}
        className="max-w-5xl mx-auto px-4 sm:px-8 pt-28 pb-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <p className="text-xs tracking-[0.16em] font-semibold text-blue-700">
            {copy.eyebrow}
          </p>
          <div
            role="group"
            aria-label="Guide language"
            className="inline-flex rounded-full border border-slate-200 bg-white p-1"
          >
            {(
              [
                ["en", "English"],
                ["zh", "中文"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={language === value}
                onClick={() => setParams({ lang: value }, { replace: true })}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${language === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight max-w-3xl text-slate-900">
          {copy.title}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mt-5 leading-relaxed">
          {copy.intro}
        </p>
        <div className="flex flex-wrap gap-3 mt-7 mb-10">
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] text-white px-5 py-3 text-sm hover:bg-[var(--accent-primary)]"
          >
            {copy.start}
            <ArrowRight size={16} />
          </Link>
          <a
            href={`/examples/olarion-task-${language}.txt`}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm hover:bg-slate-50"
          >
            <Download size={16} />
            {copy.download}
          </a>
        </div>

        <section
          className="rounded-2xl bg-blue-50 border border-blue-100 p-5 sm:p-7 mb-12"
          aria-labelledby="scope-heading"
        >
          <h2
            id="scope-heading"
            className="flex items-center gap-2 text-lg font-medium text-blue-950"
          >
            <Info className="shrink-0" size={20} />
            {copy.scopeTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-blue-950">{copy.scope}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {copy.scopeDetail}
          </p>
        </section>

        <section aria-labelledby="materials-heading">
          <h2 id="materials-heading" className="text-2xl text-slate-900 mb-5">
            {copy.materialsTitle}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {copy.materials.map((item, index) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex justify-between items-center gap-2 mb-5">
                  <span className="text-sm font-mono text-slate-400">
                    0{index + 1}
                  </span>
                  <span
                    className={`text-xs rounded-full px-2.5 py-1 ${item.required ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {item.required ? copy.required : copy.recommended}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-7 mt-2">
                  {item.text}
                </p>
                <p className="text-xs text-slate-500 leading-6 mt-4 pt-4 border-t border-slate-100">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
          <div className="flex gap-3 rounded-xl bg-slate-50 border border-slate-200 p-5 mt-4">
            <Archive size={20} className="mt-0.5 shrink-0 text-slate-500" />
            <div>
              <h3 className="text-sm font-medium">{copy.zipTitle}</h3>
              <p className="text-sm text-slate-600 leading-7 mt-1">
                {copy.zipText}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="context-heading">
          <h2 id="context-heading" className="text-2xl mb-3">
            {copy.contextTitle}
          </h2>
          <p className="text-sm text-slate-600 leading-7 mb-6">
            {copy.contextIntro}
          </p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
            {copy.context.map(([title, text]) => (
              <div key={title} className="flex gap-3">
                <CheckCircle2
                  size={18}
                  className="text-blue-600 mt-1 shrink-0"
                />
                <div>
                  <h3 className="text-base font-medium">{title}</h3>
                  <p className="text-sm text-slate-600 leading-7 mt-1">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
            <h3 className="text-sm font-medium text-amber-950">
              {copy.derivedTitle}
            </h3>
            <p className="mt-2 text-sm leading-7 text-amber-950">
              {copy.derived}
            </p>
          </div>
        </section>

        <section
          id="template"
          className="mt-12 scroll-mt-24"
          aria-labelledby="template-heading"
        >
          <h2
            id="template-heading"
            className="text-2xl mb-3 flex gap-2 items-center"
          >
            <FileText size={23} className="text-blue-600 shrink-0" />
            {copy.templateTitle}
          </h2>
          <p className="text-sm text-slate-600 leading-7 mb-5">
            {copy.templateIntro}
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-2xl bg-slate-900 text-slate-100 p-5 sm:p-7 text-sm leading-7 font-mono">
            {AUDIT_TASK_TEMPLATE[language]}
          </pre>
        </section>

        <section
          id="results"
          className="mt-12 scroll-mt-24"
          aria-labelledby="results-heading"
        >
          <h2 id="results-heading" className="text-2xl mb-5">
            {copy.resultsTitle}
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {copy.results.map(([title, text]) => (
              <article
                key={title}
                className="bg-white rounded-xl border border-slate-200 p-5"
              >
                <h3 className="text-base font-medium">{title}</h3>
                <p className="text-sm leading-7 text-slate-600 mt-2">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="evaluation"
          className="mt-12 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
          aria-labelledby="evidence-heading"
        >
          <h2 id="evidence-heading" className="text-2xl">
            {copy.evidenceTitle}
          </h2>
          <p className="text-xs leading-6 text-slate-500 mt-2">
            {copy.evidenceIntro}
          </p>
          <div className="grid grid-cols-3 gap-3 mt-6 mb-5">
            {[65, 20, 15].map((value, i) => (
              <div key={value} className="border-l-2 border-blue-200 pl-3">
                <p className="text-3xl sm:text-4xl font-serif text-slate-900">
                  {value}
                  <span className="text-sm text-slate-400"> / 100</span>
                </p>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-5">
                  {copy.stats[i]}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-7 text-slate-600">
            {copy.evidenceDetail}
          </p>
          <a
            href="https://github.com/Dennis-Sosa/Olarion/blob/main/evals/remote-report-2.0.1.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-700 mt-4 hover:underline"
          >
            {copy.evidenceLink}
            <ArrowUpRight size={16} />
          </a>
          <div className="mt-7 pt-6 border-t border-slate-100">
            <h3 className="font-medium">{copy.nextTitle}</h3>
            <p className="text-sm text-slate-600 leading-7 mt-2">
              {copy.nextIntro}
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-slate-600 leading-7">
              {copy.next.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
        <div className="mt-12 rounded-2xl bg-blue-50 p-6 flex flex-wrap justify-between items-center gap-5">
          <p className="text-lg">{copy.closing}</p>
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-800 hover:underline"
          >
            {copy.start}
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
