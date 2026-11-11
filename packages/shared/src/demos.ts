import type { DemoQuestion } from "./types";

const years = { yearFrom: 2015, yearTo: 2026, country: "Ethiopia" };

/**
 * Four demo questions. The corpus covers maternal health and malaria only,
 * so the tuberculosis question is the insufficient-evidence scenario.
 */
export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "maternal-health-ethiopia",
    label: "Maternal health in Ethiopia",
    question: "What does the evidence say about maternal health services and outcomes in Ethiopia?",
    filters: { ...years, includeEthiopia: true, includeInternational: false },
  },
  {
    id: "maternal-mortality-factors",
    label: "Maternal mortality factors",
    question: "What factors are associated with maternal mortality in the retrieved studies?",
    filters: { ...years, includeEthiopia: true, includeInternational: true },
  },
  {
    id: "malaria-prevention",
    label: "Malaria prevention",
    question: "How do malaria prevention studies compare across Ethiopian and international settings?",
    filters: { ...years, includeEthiopia: true, includeInternational: true },
  },
  {
    id: "tuberculosis-treatment-default",
    label: "Tuberculosis treatment default",
    question: "What interventions reduce tuberculosis treatment default among adults in Ethiopia?",
    filters: { ...years, includeEthiopia: true, includeInternational: true },
  },
];
