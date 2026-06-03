// Shapes returned by the FastAPI backend (PRD §10).

export interface AppConfig {
  industries: string[];
  roles: string[];
  levels: string[];
  scales: string[];
  interview_types: { technical: string[]; behavioral: string[] };
  difficulties: string[];
  modes: string[];
  personas: { key: string; company: string; industry: string; values: string[] }[];
}

export interface Evaluation {
  scores: Record<string, number>;
  rationale?: Record<string, string>;
  principles: Record<string, boolean>;
  principle_notes?: string;
  confidence_score: number;
  stronger_answer: string;
  missed_concepts: string[];
  star_notes: string;
}

export interface Report {
  overall_confidence: number;
  dimension_averages: Record<string, number>;
  principle_hit_rate: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  answers_evaluated: number;
  summary: string;
}

export interface StartResponse {
  session_id: string;
  stage: number;
  stage_label: string;
  lens: string;
  question: string;
  mode: string;
  credits: number;
}

export interface AnswerResponse {
  stage: number;
  stage_label: string;
  lens: string;
  question: string;
  action: string;
  finished: boolean;
  evaluation?: Evaluation;
  report?: Report;
}

export interface Message {
  sender: "interviewer" | "candidate";
  stage: number;
  lens: string | null;
  content: string;
}

export interface SessionDetail {
  session: { id: string; config: Record<string, string>; stage: number; status: string; report: Report | null };
  messages: Message[];
  evaluations: {
    message_id: string;
    scores: Record<string, number>;
    principles: Record<string, boolean>;
    confidence: number;
    stronger_answer: string;
    missed_concepts: string[];
    star_notes: string;
  }[];
}

export interface SessionListItem {
  id: string;
  config: Record<string, string>;
  stage: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  overall_confidence: string | null;
}

export const DIMENSION_LABELS: Record<string, string> = {
  clarity: "Clarity",
  structure: "Structure",
  privacy_terminology: "Privacy terms",
  confidence: "Confidence",
  risk_reasoning: "Risk reasoning",
  regulatory_understanding: "Regulatory",
  business_alignment: "Business align",
  org_context: "Org context",
};

export const PRINCIPLE_LABELS: Record<string, string> = {
  enterprise_scale: "Efficiency-over-budget",
  automation: "Automation",
  cognitive: "Cross-pollination",
  chaos: "Ambiguity/pivots",
  collaboration: "Collaboration",
  operational_enabler: "Compliance-as-enabler",
};
