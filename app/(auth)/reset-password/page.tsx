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

const schema = z
  .object({
    password: z.string().min(6, "Lösenord måste vara minst 6 tecken"),
    confirmPassword: z.string().min(6, "Bekräfta lösenordet")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Lösenorden matchar inte",
    path: ["confirmPassword"]
  });

type ResetPasswordValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const supabase = createClientSupabaseBrowser();
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Länken är ogiltig eller har gått ut. Begär en ny återställningslänk.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password
      });
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("Lösenordet är uppdaterat. Du kan nu logga in.");
        setTimeout(() => router.push("/login"), 1200);
      }
    } catch {
      setError("Kunde inte uppdatera lösenordet just nu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader>
          <p className="text-xs uppercase tracking-wide text-slate-500">Ferno Service</p>
          <CardTitle>Byt lösenord</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nytt lösenord</label>
              <Input type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Bekräfta nytt lösenord</label>
              <Input type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-700">{success}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Uppdaterar..." : "Spara nytt lösenord"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
