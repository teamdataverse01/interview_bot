// Shapes returned by the FastAPI backend (PRD §10).

export interface AppConfig {
  industries: string[];
  roles: string[];
  levels: string[];
  scales: string[];
  interview_types: { technical: string[]; behavioral: string[] };
  difficulties: string[];
  difficulty_help?: Record<string, string>;
  modes: string[];
  mode_help?: Record<string, string>;
  round_size?: number;
  demo_mode?: boolean;
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
  to_improve?: string;
}

export interface Report {
  overall_confidence: number;
  dimension_averages: Record<string, number>;
  principle_hit_rate: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  answers_evaluated: number;
  summary: string;
  next_focus?: string;
  // Recruiter-style hiring debrief (Temi round-4)
  recommendation?: string;
  did_well?: string[];
  held_back?: string[];
  how_to_improve?: string[];
  absolute_hire?: string;
  debrief_intro?: string;
}

export interface RoundInfo {
  round: number;
  round_size: number;
  question_in_round: number;
  questions_left_in_round: number;
  questions_asked: number;
}

export interface ModelAnswer {
  question: string;
  answer: string;
  key_points: string[];
  principles_demonstrated: string[];
  coaching_note: string;
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
  question: string | null;
  action: string;
  finished: boolean;
  evaluation?: Evaluation;
  report?: Report;
  round_complete?: boolean;
  round_summary?: Report;
  round?: number;
  round_size?: number;
  question_in_round?: number;
  questions_left_in_round?: number;
  questions_asked?: number;
}

export interface Message {
  sender: "interviewer" | "candidate";
  stage: number;
  lens: string | null;
  content: string;
  kind?: string; // turn | question | answer | ask | clarify
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
