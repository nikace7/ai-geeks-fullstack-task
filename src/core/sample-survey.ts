import type { SurveyDefinition } from "./survey-schema";

/**
 * The "Start from a sample" survey: every question type and a two-step branch, so a new admin can
 * see conditional logic working without building it first.
 */
export const sampleSurvey: SurveyDefinition = {
  title: "Customer feedback",
  description: "Two minutes, five questions. Your answers shape what we build next.",
  questions: [
    {
      id: "q_used",
      type: "single_choice",
      title: "Have you used our product in the last month?",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "q_rating",
      type: "rating",
      title: "How would you rate it overall?",
      required: true,
      showIf: { questionId: "q_used", operator: "equals", value: "yes" },
    },
    {
      id: "q_improve",
      type: "text",
      title: "What's the one thing we should fix first?",
      required: true,
      showIf: { questionId: "q_rating", operator: "lte", value: 2 },
    },
    {
      id: "q_features",
      type: "multi_choice",
      title: "Which features do you use?",
      required: false,
      options: [
        { id: "f_dashboards", label: "Dashboards" },
        { id: "f_reports", label: "Reports" },
        { id: "f_exports", label: "Exports" },
        { id: "f_api", label: "API" },
      ],
    },
    { id: "q_comments", type: "text", title: "Anything else you'd like to tell us?", required: false },
  ],
};
