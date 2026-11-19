import type { SurveyDefinition } from "@/core/survey-schema";

/**
 * A survey exercising every question type and a chain of conditions:
 *   q_used = "yes"  →  shows q_rating
 *   q_rating <= 2   →  shows q_improve   (so q_improve also hides whenever q_rating hides)
 */
export const feedbackSurvey: SurveyDefinition = {
  title: "Customer feedback",
  description: "Help us improve the product.",
  questions: [
    {
      id: "q_used",
      type: "single_choice",
      title: "Have you used our product?",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    {
      id: "q_rating",
      type: "rating",
      title: "How would you rate it?",
      required: true,
      showIf: { questionId: "q_used", operator: "equals", value: "yes" },
    },
    {
      id: "q_improve",
      type: "text",
      title: "What should we improve?",
      required: true,
      showIf: { questionId: "q_rating", operator: "lte", value: 2 },
    },
    {
      id: "q_features",
      type: "multi_choice",
      title: "Which features do you use?",
      required: false,
      options: [
        { id: "f_reports", label: "Reports" },
        { id: "f_exports", label: "Exports" },
        { id: "f_api", label: "API" },
      ],
    },
    { id: "q_comments", type: "text", title: "Anything else?", required: false },
  ],
};

/** Returns a deep copy so a test can modify it without affecting other tests. */
export const cloneSurvey = (): SurveyDefinition => structuredClone(feedbackSurvey);
