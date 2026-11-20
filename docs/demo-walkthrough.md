# Demo walkthrough

A five-minute tour that touches every feature in the brief. It doubles as the script for the demo video.

**Before you start:**
- Run `pnpm db:seed` so the demo account has its three surveys.
- Sign in as `demo@example.com` (the password is `DEMO_PASSWORD` in `.env.example`).
- Keep a private browser window ready for the respondent's view.

## 1. The dashboard (20 s)

Sign in. The list shows all three survey states at a glance:

| Survey | State | Responses |
| --- | --- | --- |
| Customer feedback | Live v2 | 60 |
| Team offsite poll | Closed | 18 |
| New hire onboarding check-in | Draft | none yet |

> Admins sign in with a JWT in an HttpOnly cookie. Each admin only ever sees their own surveys.

## 2. Building a survey (90 s)

Open **New hire onboarding check-in** (the draft).

1. **Question types.** Add a question and open the type menu: text, single choice, multiple choice, rating 1–5.
2. **Required.** Toggle Required on one question.
3. **Conditional logic.** On "What slowed you down?", show the condition. It appears only if the readiness rating is 3 or lower.
   - Change your rating in the **live preview**: the question appears and disappears.
4. **Reorder.** Drag a question in the outline.
   - Then try to drag "What slowed you down?" above the rating it depends on. The drop is refused, because a condition can only point to an earlier question.
5. **Autosave.** The header shows the save going through and settling on "All changes saved". There is no Save button.
6. **Publish.** Click **Publish** and confirm, then **Copy link**. On a survey that's already live, the same dialog lists what changes for new respondents before v(N+1) goes out.

> Drafts and published versions are separate. Publishing snapshots the draft as an immutable version, so editing a live survey never changes what respondents are answering.

## 3. Answering as a respondent (60 s)

Paste the link into the private window. There's no login.

1. Try to submit straight away. The required questions are flagged, and focus moves to the first one.
2. Give a low readiness rating. The follow-up question appears.
3. Answer a couple of questions, then **reload the page**. The **Welcome back** notice says your answers were restored. Partial responses save as you go, against a resume token that only this browser holds.
4. Submit. You see the thank-you screen.

## 4. Results (60 s)

Back as the admin, open **Customer feedback → Results**:

- **Totals:** completed, in progress, completion rate, latest response.
- **Single and multiple choice:** counts and percentages per option.
- **Rating:** the average and the 1–5 distribution.
- **Text answers:** the latest answers, newest first.
- **Versions:** switch the **version picker** from v2 to v1. v1 had no "Dashboards" option and its own 14 responses. Results are always per version, so the numbers never mix two different question sets.

Click **Close survey**, then reload the public link: it says the survey is closed. Reopen it.

> All of this is aggregated in Postgres. The server never loads every response into memory.

## 5. Under the hood (60 s)

- **`src/core`.** The schema, the logic engine and the validator are pure TypeScript. The same code runs in the builder preview, the public form and the API, so the client and server can't disagree.
- **`src/server/db/schema.ts`.** Survey JSON lives in JSONB, and responses are in their own table. A composite foreign key guarantees that a response's version belongs to its survey.
- **`test/api`.** Run `pnpm test`: 93 tests, including integration tests that call the real route handlers against a real Postgres. They cover rate limiting, versioning, resume tokens, the honeypot and every analytics number.
- **README → Trade-offs.** What was simplified on purpose, and what would come next.
