import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ForcedPasswordChangeForm } from "@/components/auth/forced-password-change-form";
import { auth } from "@/lib/auth";

export default async function CambiarPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  if (!(session.user as { mustChangePassword?: boolean }).mustChangePassword) {
    redirect("/crm");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <ForcedPasswordChangeForm />
    </main>
  );
}
