import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SurveyBuilder } from "@/features/builder/survey-builder";
import { requireAdmin } from "@/server/auth/current-admin";
import { findSurvey } from "@/server/surveys/service";

export const metadata: Metadata = { title: "Edit survey" };

export default async function EditSurveyPage({ params }: PageProps<"/surveys/[surveyId]/edit">) {
  const [{ surveyId }, admin] = await Promise.all([params, requireAdmin()]);
  const survey = await findSurvey(admin.id, surveyId);
  if (!survey) notFound();
  return <SurveyBuilder survey={survey} />;
}
