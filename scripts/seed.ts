/**
 * Creates the demo account with three surveys, so a fresh deployment has results to explore:
 *   - "Customer feedback": live, two published versions, about 60 responses, a few in progress
 *   - "Team offsite poll": closed, one version
 *   - "New hire onboarding check-in": a draft that was never published
 *
 *   pnpm db:seed                                    # the database in .env
 *   DATABASE_URL=<production url> pnpm db:seed      # e.g. Neon, after `pnpm db:migrate`
 *
 * Safe to re-run: it resets the demo account's password and surveys and touches nothing else.
 * Runs on Node's built-in TypeScript support. The react-server condition turns the
 * `server-only` guard in password.ts into a no-op, as it is inside Next.js.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { sampleSurvey } from "../src/core/sample-survey.ts";
import { surveyDefinitionSchema, type Answers, type SurveyDefinition } from "../src/core/survey-schema.ts";
import { hashPassword } from "../src/server/auth/password.ts";
import { admins, responses, surveys, surveyVersions } from "../src/server/db/schema.ts";

const DEMO_EMAIL = "demo@example.com";
const DAY = 24 * 60 * 60 * 1000;

if (existsSync(".env")) process.loadEnvFile(".env");
const { DATABASE_URL, DEMO_PASSWORD } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) throw new Error("Set DEMO_PASSWORD (8+ characters), see .env.example.");

// A fixed seed, so every run produces the same data and the demo looks the same everywhere.
let seed = 20261120;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const some = <T>(items: readonly T[], chance: number): T[] => items.filter(() => random() < chance);
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// ---------------------------------------------------------------------------------------------
// Survey definitions

/** v1 went out before Dashboards shipped; v2 added it as an option. */
const feedbackV2 = surveyDefinitionSchema.parse(sampleSurvey);
const feedbackV1 = surveyDefinitionSchema.parse({
  ...sampleSurvey,
  questions: sampleSurvey.questions.map((q) =>
    q.type === "multi_choice" ? { ...q, options: q.options.filter((o) => o.id !== "f_dashboards") } : q,
  ),
});

const offsite = surveyDefinitionSchema.parse({
  title: "Team offsite poll",
  description: "Help us plan the spring offsite. Voting closes Friday.",
  questions: [
    {
      id: "q_place",
      type: "single_choice",
      title: "Where should we go?",
      required: true,
      options: [
        { id: "mountains", label: "Mountain lodge" },
        { id: "coast", label: "Coastal town" },
        { id: "city", label: "City break" },
      ],
    },
    {
      id: "q_activities",
      type: "multi_choice",
      title: "What would you like on the agenda?",
      required: false,
      options: [
        { id: "hike", label: "Group hike" },
        { id: "cooking", label: "Cooking class" },
        { id: "workshops", label: "Planning workshops" },
        { id: "free", label: "Free time" },
      ],
    },
    { id: "q_excited", type: "rating", title: "How excited are you?", required: true },
    {
      id: "q_worth",
      type: "text",
      title: "What would make it worth the trip for you?",
      required: false,
      showIf: { questionId: "q_excited", operator: "lte", value: 2 },
    },
    { id: "q_diet", type: "text", title: "Any dietary needs we should plan for?", required: false },
  ],
});

const onboarding = surveyDefinitionSchema.parse({
  title: "New hire onboarding check-in",
  description: "A quick pulse at the end of your first two weeks.",
  questions: [
    { id: "q_ready", type: "rating", title: "How ready do you feel for your role?", required: true },
    {
      id: "q_blockers",
      type: "multi_choice",
      title: "What slowed you down?",
      required: false,
      options: [
        { id: "access", label: "Tool access" },
        { id: "docs", label: "Missing documentation" },
        { id: "people", label: "Not knowing who to ask" },
      ],
      showIf: { questionId: "q_ready", operator: "lte", value: 3 },
    },
    {
      id: "q_buddy",
      type: "single_choice",
      title: "Did you have an onboarding buddy?",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    },
    { id: "q_note", type: "text", title: "Anything we should change for the next hire?", required: false },
  ],
});

// ---------------------------------------------------------------------------------------------
// Answers. Generated to follow each survey's logic, as the form and API would enforce.

const IMPROVEMENTS = [
  "Exports time out on big date ranges.",
  "Search is slow once you have a lot of reports.",
  "The mobile layout cuts off the charts.",
  "Too many clicks to share a dashboard.",
  "Billing page is confusing.",
  "Onboarding emails came too often.",
];
const COMMENTS = [
  "The new filters saved me an hour this week.",
  "Support answered within minutes. Great job.",
  "Would love a dark mode.",
  "Please add Slack notifications for new responses.",
  "The API docs are clear and the examples work.",
  "Keyboard shortcuts would make this even faster.",
  "Happy customer for two years now.",
  "Scheduled exports would be a big win for us.",
];
const DIETS = ["Vegetarian", "No nuts, please", "Gluten-free", "Vegan", "Halal", "Lactose intolerant"];
const WORTH = ["Fewer meetings, more time together.", "Somewhere reachable by train.", "Shorter trip, two days max."];

// Weighted towards happy customers, with a tail of unhappy ones who reveal the follow-up question.
const FEEDBACK_RATINGS = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5];

function feedbackAnswers(definition: SurveyDefinition): Answers {
  const featureOptions = definition.questions.find((q) => q.id === "q_features");
  const features = featureOptions?.type === "multi_choice" ? some(featureOptions.options.map((o) => o.id), 0.45) : [];
  const used = random() < 0.8;
  const rating = used ? pick(FEEDBACK_RATINGS) : null;
  return {
    q_used: used ? "yes" : "no",
    ...(rating !== null && { q_rating: rating }),
    ...(rating !== null && rating <= 2 && { q_improve: pick(IMPROVEMENTS) }),
    ...(features.length > 0 && { q_features: features }),
    ...(random() < 0.35 && { q_comments: pick(COMMENTS) }),
  };
}

function offsiteAnswers(): Answers {
  const excited = pick([1, 2, 3, 3, 4, 4, 4, 5, 5, 5]);
  const activities = some(["hike", "cooking", "workshops", "free"], 0.5);
  return {
    q_place: pick(["mountains", "mountains", "coast", "coast", "coast", "city"]),
    ...(activities.length > 0 && { q_activities: activities }),
    q_excited: excited,
    ...(excited <= 2 && random() < 0.7 && { q_worth: pick(WORTH) }),
    ...(random() < 0.3 && { q_diet: pick(DIETS) }),
  };
}

// ---------------------------------------------------------------------------------------------
// Rows

type ResponseRow = typeof responses.$inferInsert;

/** Completed responses spread evenly between two points in time, oldest first. */
function completed(
  surveyId: string,
  versionId: string,
  count: number,
  fromDaysAgo: number,
  toDaysAgo: number,
  answer: () => Answers,
): ResponseRow[] {
  return Array.from({ length: count }, (_, i) => {
    const completedAt = daysAgo(fromDaysAgo - ((fromDaysAgo - toDaysAgo) * (i + random())) / count);
    const startedAt = new Date(completedAt.getTime() - (1 + random() * 5) * 60_000);
    return { surveyId, versionId, status: "completed", answers: answer(), createdAt: startedAt, updatedAt: completedAt, completedAt };
  });
}

/** Started but not submitted. Their resume tokens are random and thrown away, so nobody can resume them. */
function inProgress(surveyId: string, versionId: string, answers: Answers[]): ResponseRow[] {
  return answers.map((partial) => ({
    surveyId,
    versionId,
    status: "in_progress",
    answers: partial,
    resumeTokenHash: createHash("sha256").update(randomBytes(32)).digest("base64url"),
    createdAt: daysAgo(random()),
  }));
}

async function seedDemo(databaseUrl: string, password: string) {
  const db = drizzle(databaseUrl);
  try {
    const passwordHash = await hashPassword(password);
    // One transaction: a failed run leaves the previous demo data as it was.
    const counts = await db.transaction(async (tx) => {
      const [admin] = await tx
        .insert(admins)
        .values({ email: DEMO_EMAIL, passwordHash })
        .onConflictDoUpdate({ target: admins.email, set: { passwordHash } })
        .returning({ id: admins.id });
      await tx.delete(surveys).where(eq(surveys.ownerId, admin.id)); // cascades to versions and responses

      const [feedback, poll] = await tx
        .insert(surveys)
        .values([
          { ownerId: admin.id, status: "published", draft: feedbackV2, latestVersion: 2, createdAt: daysAgo(24), updatedAt: daysAgo(11) },
          { ownerId: admin.id, status: "closed", draft: offsite, latestVersion: 1, createdAt: daysAgo(40), updatedAt: daysAgo(26) },
          { ownerId: admin.id, status: "draft", draft: onboarding, createdAt: daysAgo(1), updatedAt: daysAgo(0.1) },
        ])
        .returning({ id: surveys.id });

      const [v1, v2, pollV1] = await tx
        .insert(surveyVersions)
        .values([
          { surveyId: feedback.id, version: 1, definition: feedbackV1, publishedAt: daysAgo(22) },
          { surveyId: feedback.id, version: 2, definition: feedbackV2, publishedAt: daysAgo(11) },
          { surveyId: poll.id, version: 1, definition: offsite, publishedAt: daysAgo(38) },
        ])
        .returning({ id: surveyVersions.id });

      const rows = [
        ...completed(feedback.id, v1.id, 14, 22, 11.5, () => feedbackAnswers(feedbackV1)),
        ...completed(feedback.id, v2.id, 46, 11, 0.05, () => feedbackAnswers(feedbackV2)),
        ...inProgress(feedback.id, v2.id, [{ q_used: "yes" }, { q_used: "yes", q_rating: 4 }, { q_used: "no" }]),
        ...completed(poll.id, pollV1.id, 18, 38, 27, offsiteAnswers),
      ];
      await tx.insert(responses).values(rows);
      return rows.length;
    });
    console.log(`Seeded ${DEMO_EMAIL}: 3 surveys, ${counts} responses.`);
  } finally {
    await db.$client.end();
  }
}

await seedDemo(DATABASE_URL, DEMO_PASSWORD);
