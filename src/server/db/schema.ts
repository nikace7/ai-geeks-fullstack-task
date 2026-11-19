import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Answers, SurveyDefinition } from "@/core/survey-schema";

/**
 * Relational where it matters (ownership, versions, integrity), JSON where the shape is dynamic
 * (survey definitions, answers). Postgres JSONB gives us both in one database.
 */

export const surveyStatus = pgEnum("survey_status", ["draft", "published", "closed"]);
export const responseStatus = pgEnum("response_status", ["in_progress", "completed"]);

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lower-cased by the auth service
  passwordHash: text("password_hash").notNull(),
  createdAt,
});

export const surveys = pgTable(
  "surveys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    status: surveyStatus("status").notNull().default("draft"),
    /** The editable working copy. Respondents never see it until it's published as a version. */
    draft: jsonb("draft").$type<SurveyDefinition>().notNull(),
    /** Highest published version number; null until the first publish. */
    latestVersion: integer("latest_version"),
    createdAt,
    updatedAt,
  },
  (t) => [index("surveys_owner_updated_idx").on(t.ownerId, t.updatedAt)],
);

/** Immutable snapshots. Publishing never edits a version; it adds the next one. */
export const surveyVersions = pgTable(
  "survey_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surveyId: uuid("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<SurveyDefinition>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("survey_versions_survey_version_uq").on(t.surveyId, t.version),
    // Target for the composite foreign key on responses below.
    unique("survey_versions_survey_id_id_uq").on(t.surveyId, t.id),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored alongside version_id so "all responses for a survey" needs no join.
    surveyId: uuid("survey_id").notNull(),
    /** The exact version the respondent answered, so later edits can't corrupt this response. */
    versionId: uuid("version_id").notNull(),
    status: responseStatus("status").notNull(),
    answers: jsonb("answers").$type<Answers>().notNull().default({}),
    /** SHA-256 of the secret the respondent's browser holds to resume a partial response. */
    resumeTokenHash: text("resume_token_hash"),
    createdAt,
    updatedAt,
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    // The database itself guarantees a response's version belongs to the same survey.
    foreignKey({
      name: "responses_survey_version_fk",
      columns: [t.surveyId, t.versionId],
      foreignColumns: [surveyVersions.surveyId, surveyVersions.id],
    }).onDelete("cascade"),
    index("responses_version_status_idx").on(t.versionId, t.status),
    index("responses_survey_status_idx").on(t.surveyId, t.status),
  ],
);

/** Fixed-window counters. Stored in Postgres so limits hold across serverless instances. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});
