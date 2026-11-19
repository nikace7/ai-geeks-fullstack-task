import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-12 sm:justify-center">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <Logo />
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
