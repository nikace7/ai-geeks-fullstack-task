"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { fieldClasses } from "@/components/ui/cx";
import { FieldError, FormError } from "@/components/ui/field";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";

const COPY = {
  login: {
    title: "Sign in",
    subtitle: "Welcome back. Sign in to manage your surveys.",
    submit: "Sign in",
    pending: "Signing in…",
    endpoint: "/auth/login",
    passwordAutoComplete: "current-password",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/register",
  },
  register: {
    title: "Create your account",
    subtitle: "Build a survey, share the link, and watch answers come in.",
    submit: "Create account",
    pending: "Creating account…",
    endpoint: "/auth/register",
    passwordAutoComplete: "new-password",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
} as const;

interface Credentials {
  email: string;
  password: string;
}

export function AuthForm({ mode }: { mode: keyof typeof COPY }) {
  const copy = COPY[mode];
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { run, status, error, reset } = useAction((body: Credentials) => api(copy.endpoint, { body }));

  const fields = error?.details?.fields ?? {};
  const isEmailTaken = error?.code === "EMAIL_TAKEN";
  const emailError = isEmailTaken ? error.message : fields.email;
  const passwordError = fields.password;
  // Field problems show under their field; anything else (wrong password, rate limit, offline) above the button.
  const formError = error && !emailError && !passwordError ? error.message : null;

  // Move focus to the first field the server rejected, so keyboard users land on the problem.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run({ email: String(form.get("email")), password: String(form.get("password")) });
    // A full page load, not router.replace: the logo prefetched /surveys while signed out, and the
    // client router would replay that cached redirect straight back to /login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the fix
    if (result?.success) window.location.assign("/surveys");
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={() => {
        if (error) reset();
      }} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-zinc-600">{copy.subtitle}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          className={`${fieldClasses} h-10`}
        />
        {emailError && (
          <FieldError id="email-error">
            {emailError}
            {isEmailTaken && (
              <>
                {" "}
                <Link href="/login" className="font-medium underline underline-offset-2">
                  Sign in instead
                </Link>
              </>
            )}
          </FieldError>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={copy.passwordAutoComplete}
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={128}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "password-error" : mode === "register" ? "password-hint" : undefined}
            className={`${fieldClasses} h-10 pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-1 right-1 rounded-md px-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {passwordError ? (
          <FieldError id="password-error">{passwordError}</FieldError>
        ) : (
          mode === "register" && (
            <p id="password-hint" className="text-[13px] text-zinc-500">
              At least 8 characters.
            </p>
          )
        )}
      </div>

      {formError && <FormError>{formError}</FormError>}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        // Stays pending after success, until the dashboard replaces this page.
        status={status === "done" ? "pending" : status}
        pendingLabel={copy.pending}
      >
        {copy.submit}
      </Button>

      <p className="text-center text-zinc-600">
        {copy.switchPrompt}{" "}
        <Link href={copy.switchHref} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </form>
  );
}
