import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { SurveyClosed } from "@/features/form/form-end-state";
import { SurveyForm } from "@/features/form/survey-form";
import { getPublicSurvey } from "@/server/surveys/service";

/** One query per request, shared by the metadata and the page. A malformed id never reaches Postgres. */
const loadSurvey = cache((surveyId: string) => (z.uuid().safeParse(surveyId).success ? getPublicSurvey(surveyId) : null));

export async function generateMetadata({ params }: PageProps<"/s/[surveyId]">): Promise<Metadata> {
  const survey = await loadSurvey((await params).surveyId);
  return {
    title: survey?.definition.title ?? "Survey not found",
    description: survey?.definition.description || undefined,
    // Share links are meant for the people they're sent to, not search results.
    robots: { index: false },
  };
}

/** Public: no sign-in. Closed and unknown surveys are answered here, before any form code loads. */
export default async function SurveyPage({ params }: PageProps<"/s/[surveyId]">) {
  const survey = await loadSurvey((await params).surveyId);
  if (!survey) notFound();
  if (survey.status === "closed") return <SurveyClosed title={survey.definition.title} />;
  return <SurveyForm surveyId={survey.surveyId} live={{ versionId: survey.versionId, definition: survey.definition }} />;
}
