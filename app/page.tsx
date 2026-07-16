import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

// Root page redirects authenticated users to their dashboard
// Unauthenticated users go to login
export default async function RootPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");

  switch (session.user.role) {
    case "ADMIN":    redirect("/admin");
    case "LECTURER": redirect("/lecturer");
    case "STUDENT":  redirect("/student");
    default:         redirect("/login");
  }
}
