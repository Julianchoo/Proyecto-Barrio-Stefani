import { requireAuth } from "@/lib/session";
import { CrmSidebar } from "@/components/crm/crm-sidebar";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <CrmSidebar />
      {/* Desktop: offset for sidebar. Mobile: offset for top bar */}
      <div className="md:pl-56 pt-14 md:pt-0">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
