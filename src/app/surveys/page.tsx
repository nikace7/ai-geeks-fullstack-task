import type { Metadata } from "next";
import { DocumentIcon } from "@/components/ui/icons";
import { AppHeader } from "@/features/surveys/app-header";
import { NewSurveyButton } from "@/features/surveys/new-survey-button";
import { SurveyList } from "@/features/surveys/survey-list";
import { requireAdmin } from "@/server/auth/current-admin";
import { listSurveys } from "@/server/surveys/service";

export const metadata: Metadata = { title: "Surveys" };

export default async function SurveysPage() {
  const admin = await requireAdmin();
  const surveys = await listSurveys(admin.id);

  return (
    <>
      <AppHeader email={admin.email} />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
            <p className="text-zinc-600">Build a form, share its link, and watch the answers come in.</p>
          </div>
          <NewSurveyButton>New survey</NewSurveyButton>
        </div>
        {surveys.length > 0 ? <SurveyList surveys={surveys} /> : <EmptyState />}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-[10px] bg-zinc-100 text-zinc-600">
        <DocumentIcon size={20} />
      </span>
      <h2 className="text-base font-semibold">No surveys yet</h2>
      <p className="max-w-[440px] text-zinc-600">
        A survey is a list of questions you share as a link. Answers and charts show up here as people respond.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <NewSurveyButton>Create a survey</NewSurveyButton>
        <NewSurveyButton sample variant="secondary">
          Start from a sample
        </NewSurveyButton>
      </div>
    </div>
  );
}
