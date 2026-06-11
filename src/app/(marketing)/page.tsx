import { redirect } from "next/navigation";

import { LandingPage } from "@/components/marketing/LandingPage";
import { getProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await getProfile();
  if (profile?.status === "active") {
    redirect("/app/dashboard");
  }

  return <LandingPage />;
}
