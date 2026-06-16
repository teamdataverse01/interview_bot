// Privacy acronyms & terms auto-defined in the chat the first time they appear (Temi §1C).
export const GLOSSARY: Record<string, string> = {
  DSAR: "Data Subject Access Request — a person's legal request to see, correct, or delete the data a company holds on them.",
  DPIA: "Data Protection Impact Assessment — a structured review of privacy risks before launching a feature that processes personal data.",
  PIA: "Privacy Impact Assessment — a lighter-weight assessment of how a project affects personal data.",
  RoPA: "Record of Processing Activities — a GDPR-required inventory of how an organization processes personal data.",
  GDPR: "General Data Protection Regulation — the EU's comprehensive data-protection law.",
  CCPA: "California Consumer Privacy Act — California's consumer data-privacy law.",
  CPRA: "California Privacy Rights Act — expands and strengthens the CCPA.",
  NDPA: "Nigeria Data Protection Act — Nigeria's data-protection law.",
  NDPR: "Nigeria Data Protection Regulation — Nigeria's earlier data-protection framework.",
  PII: "Personally Identifiable Information — data that can identify a specific person.",
  DPO: "Data Protection Officer — the person accountable for an organization's data-protection compliance.",
  PbD: "Privacy by Design — building privacy protections into systems from the start.",
  SLA: "Service-Level Agreement — a committed response/resolution timeframe.",
  GRC: "Governance, Risk, and Compliance — the tooling/processes that manage enterprise risk and controls.",
  SDLC: "Software Development Life Cycle — the stages of building and shipping software.",
  PCI: "Payment Card Industry — security standards (PCI-DSS) for handling card data.",
  "PCI-DSS": "Payment Card Industry Data Security Standard — prescriptive controls for cardholder data.",
  ACL: "Access Control List — the rules defining who can access a given resource.",
  XFN: "Cross-Functional — work spanning multiple teams (Legal, Eng, Product, etc.).",
  OKR: "Objectives and Key Results — a goal-setting framework.",
  "AI RMF": "AI Risk Management Framework — NIST's framework for managing AI risks.",
  ISO: "International Organization for Standardization — publishes standards like ISO 27001 (security).",
};

// Longest-first so multi-word terms match before their parts.
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

export function findTerms(text: string): string[] {
  const found = new Set<string>();
  for (const t of TERMS) {
    const re = new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`);
    if (re.test(text)) found.add(t);
  }
  return [...found];
}
