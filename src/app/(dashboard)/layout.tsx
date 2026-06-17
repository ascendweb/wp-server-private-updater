import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { HeaderProvider, HeaderSlot } from "@/components/page-header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <HeaderProvider>
          <header className="flex h-14 items-center gap-2 border-b px-6">
            <SidebarTrigger className="-ml-2" />
            <HeaderSlot />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </HeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
