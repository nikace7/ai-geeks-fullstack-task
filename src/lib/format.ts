const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const numberFormat = new Intl.NumberFormat("en-US");

/** "5 minutes ago", "yesterday", "2 weeks ago". Under a minute reads "just now". */
export function timeAgo(date: Date | string, now = Date.now()): string {
  const seconds = Math.trunc((new Date(date).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}

export const formatDate = (date: Date | string) => dateFormat.format(new Date(date));

export const formatNumber = (n: number) => numberFormat.format(n);

/** "1 question", "3 questions". */
export const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? "" : "s"}`;

/** The link respondents open. Built from the current origin, so it is right on localhost and in production. */
export const publicSurveyUrl = (surveyId: string) => new URL(`/s/${surveyId}`, window.location.origin).href;
