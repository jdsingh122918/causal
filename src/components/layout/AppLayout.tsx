import { ProjectsSidebar } from "./ProjectsSidebar";
import { Header } from "./Header";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground">
        <ProjectsSidebar />
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          <Header />
          <main className="flex-1 overflow-auto bg-background p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
