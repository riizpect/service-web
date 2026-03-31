"use client";

// For MVP, we reuse the "new case" component logic later.
// Placeholder so the route exists and can be wired up in a follow-up iteration.

import { useRouter } from "next/navigation";

export default function EditCasePlaceholder({
  params
}: {
  params: { id: string };
}) {
  const router = useRouter();
  // Simple redirect for now so editing opens view page.
  if (typeof window !== "undefined") {
    router.replace(`/cases/${params.id}`);
  }
  return null;
}

