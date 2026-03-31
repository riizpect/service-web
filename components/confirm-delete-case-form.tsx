"use client";

import { Button } from "@/components/ui/button";

type ConfirmDeleteCaseFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function ConfirmDeleteCaseForm({ action }: ConfirmDeleteCaseFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const ok = window.confirm(
          "Är du säker på att du vill ta bort serviceärendet? Detta går inte att ångra."
        );
        if (!ok) event.preventDefault();
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        Ta bort
      </Button>
    </form>
  );
}
