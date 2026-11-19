import { redirect } from "next/navigation";

// The admin home is the survey list; signed-out visitors are sent on to /login from there.
export default function Home() {
  redirect("/surveys");
}
