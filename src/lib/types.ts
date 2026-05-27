export type StimulusType = "letters" | "shapes" | "rotated-e";
export type Level = 0 | 1 | 2 | 3;
export type TimingMode = "auto" | "self";

export interface StudyConfig {
  studyName: string;
  stimulusTypes: StimulusType[];
  levels: Level[];
  timingMode: TimingMode;
  totalMs: number;       // total per-screen
  displayMs: number;     // stimulus visible portion
  trialsPerBlock: number;
  targetRate: number;    // 0..1, fraction of scorable trials that should be matches
  zeroBackTarget: string; // for 0-back letter target (default "X")
  customQuestions: CustomQuestion[];
  shapes: string[];      // shape ids, see SHAPE_LIBRARY
  rotations: number[];   // rotated-E angles in deg
  collectDemographics: boolean;
}

export interface CustomQuestion {
  id: string;
  prompt: string;
  type: "open" | "mcq-alpha" | "mcq-roman" | "likert";
  options?: string[];
}

export interface Demographics {
  age?: string; gender?: string; handedness?: string; education?: string;
  extras?: Record<string, string>;
}

export interface ConsentRecord {
  consented: boolean; ts: number; participantId: string;
}

export interface Trial {
  trialIndex: number;
  stimulusType: StimulusType;
  level: Level;
  stimulus: string;        // letter / shape id / rotation angle string
  isPriming: boolean;
  expectedMatch: boolean | null; // null on priming
  responded: boolean;
  responseYes: boolean | null;   // true=yes, false=no, null=no-response
  rtMs: number | null;
  correct: boolean | null;
  onsetTs: number;
}

export interface BlockResult {
  stimulusType: StimulusType;
  level: Level;
  trials: Trial[];
  perLevelTLX?: TLXResponse;
}

export interface TLXResponse {
  mentalDemand: number; physicalDemand: number; temporalDemand: number;
  performance: number; effort: number; frustration: number;
  paasMentalEffort: number; // 1..9
}

export interface Session {
  participantId: string;
  startedAt: number;
  finishedAt?: number;
  config: StudyConfig;
  demographics?: Demographics;
  consent?: ConsentRecord;
  blocks: BlockResult[];
  globalTLX?: TLXResponse;
  customAnswers?: Record<string, string>;
}

export const SHAPE_LIBRARY: Record<string, string> = {
  circle: `<circle cx="50" cy="50" r="34" />`,
  square: `<rect x="18" y="18" width="64" height="64" rx="6" />`,
  triangle: `<polygon points="50,12 88,84 12,84" />`,
  star: `<polygon points="50,8 61,38 92,38 67,57 76,88 50,70 24,88 33,57 8,38 39,38" />`,
  diamond: `<polygon points="50,10 90,50 50,90 10,50" />`,
  hexagon: `<polygon points="50,10 86,30 86,70 50,90 14,70 14,30" />`,
  heart: `<path d="M50 84 C20 64 12 44 26 30 C38 18 50 28 50 38 C50 28 62 18 74 30 C88 44 80 64 50 84 Z" />`,
  cross: `<path d="M40 12 H60 V40 H88 V60 H60 V88 H40 V60 H12 V40 H40 Z" />`,
};

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
