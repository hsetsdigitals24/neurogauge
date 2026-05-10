import { StudyConfig } from "./types";

export const DEFAULT_CONFIG: StudyConfig = {
  studyName: "N-Back Study",
  stimulusTypes: ["letters", "shapes", "rotated-e"],
  levels: [0, 1, 2, 3],
  timingMode: "auto",
  totalMs: 3000,
  displayMs: 500,
  trialsPerBlock: 20,
  targetRate: 0.3,
  zeroBackTarget: "X",
  customQuestions: [],
  shapes: ["circle", "square", "triangle", "star", "diamond", "hexagon"],
  rotations: [0, 90, 180, 270],
  collectDemographics: true,
};
