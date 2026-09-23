import { motion } from "motion/react";
import { Link } from "react-router";
import { Clock, Network, Layers, ArrowRight, CheckCircle } from "lucide-react";
import { AmbientBackground } from "../components/AmbientBackground";
import { FloatingChat } from "../components/FloatingChat";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";

export function Landing() {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const auditTypes = [
    {
      icon: Clock,
      title: "Temporal Leakage",
      description:
        "Detects when future information is inadvertently available at prediction time.",
    },
    {
      icon: Network,
      title: "Feature / Proxy Leakage",
      description:
        "Identifies features that are proxies for the target or contain leaked information.",
    },
    {
      icon: Layers,
      title: "Structure / Pipeline Leakage",
      description:
        "Audits data splits, transformations, and pipeline design for methodological flaws.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Define audit context",
      description:
        "Specify prediction task, time boundaries, and data structure.",
    },
    {
      number: "02",
      title: "Run audit",
      description:
        "Run rule and AI checks, with coverage recorded for each applicable stage.",
    },
    {
      number: "03",
      title: "Review evidence and fix plan",
      description:
        "Inspect findings, understand root causes, and implement corrections.",
    },
  ];

  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <Navigation />

      {/* Ambient background animation - centered on hero */}
      <div className="absolute top-0 left-0 right-0 h-[900px] overflow-hidden pointer-events-none">
        <AmbientBackground variant="subtle" />
      </div>

      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="max-w-5xl mx-auto px-8 pt-32 pb-16 relative z-10"
      >
        <motion.div variants={fadeUpVariants} className="text-center mb-4">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[var(--accent-primary-pale)] border border-[var(--border)] text-[var(--accent-primary)] mb-6">
            <motion.span
              className="inline-block w-2.5 h-2.5 rounded-full shadow-[0_0_4px_rgba(167,191,251,0.6)]"
              style={{
                background:
                  "radial-gradient(circle, #A7BFFB 30%, #BFDBFE 70%, #D4E8FF 100%)",
              }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-sm font-medium">
              AI-assisted workflow review
            </span>
          </div>
        </motion.div>

        <motion.h1
          variants={fadeUpVariants}
          className="font-serif text-6xl text-center mb-6 text-[var(--foreground)]"
        >
          Olarion
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          className="text-3xl text-center mb-4 text-[var(--foreground)] max-w-3xl mx-auto"
        >
          Make model trust visible before deployment
        </motion.p>

        <motion.p
          variants={fadeUpVariants}
          className="text-base text-center mb-12 text-[var(--muted-foreground)] max-w-2xl mx-auto"
        >
          Review CSV headers, Python code and prediction context for potential
          data leakage. Inspect evidence and check coverage before relying on a
          conclusion.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
          >
            <span>Start Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/guide"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors"
          >
            Upload guide & examples
          </Link>
        </motion.div>
      </motion.section>

      <section
        className="max-w-5xl mx-auto px-4 sm:px-8 relative z-10"
        aria-labelledby="prepare-heading"
      >
        <div className="rounded-2xl border border-blue-100 bg-white/80 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="flex-1">
            <h2 id="prepare-heading" className="text-xl mb-2">
              Prepare a useful audit
            </h2>
            <p className="text-sm text-slate-600 leading-7">
              Bring a CSV header, your actual preprocessing code, and a clear
              prediction time. Add training code to extend the checks. Row
              values are not analyzed; more rows do not increase this version’s
              accuracy.
            </p>
          </div>
          <div className="shrink-0 space-y-2 text-sm">
            <Link
              to="/guide"
              className="flex items-center gap-2 font-medium text-blue-700 hover:underline"
            >
              File requirements <ArrowRight size={15} />
            </Link>
            <Link
              to="/guide?lang=zh"
              className="block text-blue-700 hover:underline"
            >
              中文上传指南
            </Link>
            <Link
              to="/guide#evaluation"
              className="block text-slate-500 hover:underline"
            >
              Evaluation &amp; limitations
            </Link>
          </div>
        </div>
      </section>

      {/* Audit Categories */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          visible: { transition: { staggerChildren: 0.15 } },
        }}
        className="max-w-5xl mx-auto px-8 py-16 relative z-10"
      >
        <motion.h2
          variants={fadeUpVariants}
          className="text-2xl text-center mb-12 text-[var(--foreground)]"
        >
          Core Audit Categories
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {auditTypes.map((audit, index) => (
            <motion.div
              key={index}
              variants={fadeUpVariants}
              whileHover={{
                y: -4,
                boxShadow: "0 8px 30px rgba(167, 191, 251, 0.2)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-[var(--border)] hover:border-[var(--accent-primary)]/30 hover:bg-white/90 transition-colors duration-300 cursor-default"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, #E8F2FF 0%, #BFDBFE 50%, #A7BFFB 100%)",
                }}
              >
                <audit.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg mb-2 text-[var(--foreground)]">
                {audit.title}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {audit.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={{
          visible: { transition: { staggerChildren: 0.15 } },
        }}
        className="max-w-5xl mx-auto px-8 py-16 relative z-10"
      >
        <motion.h2
          variants={fadeUpVariants}
          className="text-2xl text-center mb-12 text-[var(--foreground)]"
        >
          How It Works
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={fadeUpVariants}
              className="relative"
            >
              {/* Step Number */}
              <div className="mb-4">
                <span
                  className="text-5xl font-serif"
                  style={{
                    background:
                      "linear-gradient(135deg, #A7BFFB 0%, #BFDBFE 50%, #D4E8FF 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg mb-3 text-[var(--foreground)]">
                {step.title}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {step.description}
              </p>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -right-4 w-8 h-px bg-[var(--border)]" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <Footer />

      {/* Floating Chat Assistant */}
      <FloatingChat context="landing" />
    </div>
  );
}
