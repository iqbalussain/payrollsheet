import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, HardHat, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/integrations/supabase/external-client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setErrorMessage(error.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl md:min-h-[580px] md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-navy p-8 text-primary-foreground sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <HardHat size={26} />
            </div>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.22em] text-white/65">
              Site Payroll Manager
            </p>
            <h1 className="mt-3 max-w-md font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              Payroll, organized for every site.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/70">
              Securely manage your employees, monthly payroll, advances and salary slips in one
              place.
            </p>
          </div>
          <div className="relative mt-12 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <ShieldCheck size={20} className="shrink-0 text-emerald-300" />
            <p className="text-xs leading-5 text-white/75">
              Access is restricted to authorized payroll administrators and HR staff.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <p className="text-sm font-semibold text-gold-dark">Welcome back</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-navy">
                Sign in to continue
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use the work email and password assigned to your account.
              </p>
            </div>

            <form onSubmit={signIn} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-foreground">Work email</span>
                <span className="relative block">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="h-12 rounded-xl pl-10"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-foreground">Password</span>
                <span className="relative block">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-12 rounded-xl px-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger"
                >
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-navy text-base font-bold hover:bg-navy-dark"
              >
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight size={17} />}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              Need an account or password reset? Contact your payroll administrator.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
