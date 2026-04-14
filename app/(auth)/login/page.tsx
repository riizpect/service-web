"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(6, "Lösenord måste vara minst 6 tecken")
});

type LoginFormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const supabase = createClientSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Något gick fel vid inloggning.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfoMessage(null);
    const email = form.getValues("email");
    if (!email) {
      setError("Fyll i din e-postadress först.");
      return;
    }

    setResettingPassword(true);
    try {
      const supabase = createClientSupabaseBrowser();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setInfoMessage(
          "Om adressen finns registrerad har vi skickat en länk för att byta lösenord."
        );
      }
    } catch {
      setError("Kunde inte skicka återställningslänk just nu.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDemoLogin = async () => {
    if (!demoEmail || !demoPassword) {
      setError("Testkonto är inte konfigurerat än.");
      return;
    }
    setError(null);
    setInfoMessage(null);
    setDemoLoading(true);
    try {
      const supabase = createClientSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Kunde inte logga in med testkonto.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader>
          <p className="text-xs uppercase tracking-wide text-slate-500">Ferno Service</p>
          <CardTitle>Logga in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">E-post</label>
              <Input
                type="email"
                placeholder="din.epost@företag.se"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lösenord</label>
              <Input type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {infoMessage && <p className="text-sm text-emerald-700">{infoMessage}</p>}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading || resettingPassword || demoLoading}
              onClick={handleForgotPassword}
            >
              {resettingPassword ? "Skickar länk..." : "Glömt lösenord?"}
            </Button>
            {demoEmail && demoPassword && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading || resettingPassword || demoLoading}
                onClick={handleDemoLogin}
              >
                {demoLoading ? "Loggar in..." : "Logga in med testkonto"}
              </Button>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || resettingPassword || demoLoading}
            >
              {loading ? "Loggar in..." : "Logga in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

