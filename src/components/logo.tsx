import Link from "next/link";
import { LogoIcon } from "./ui/icons";

export function Logo() {
  return (
    <Link href="/surveys" className="flex items-center gap-2.5 font-semibold text-zinc-900">
      <span className="grid size-6 place-items-center rounded-md bg-zinc-900 text-white">
        <LogoIcon size={14} />
      </span>
      Survey Builder
    </Link>
  );
}
