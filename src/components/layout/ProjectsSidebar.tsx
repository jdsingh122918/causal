import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import { Plus, Folder } from "lucide-react";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
import { cn } from "@/lib/utils";

export function ProjectsSidebar() {
  const { projects, currentProject, selectProject } = useProjects();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setNewProjectOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>All Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No projects yet. Create one to get started.
                  </div>
                ) : (
                  projects.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        onClick={() => selectProject(project.id)}
                        isActive={currentProject?.id === project.id}
                        className={cn(
                          "w-full justify-start",
                          currentProject?.id === project.id &&
                            "bg-accent font-medium"
                        )}
                      >
                        <Folder className="h-4 w-4" />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-4">
          <p className="text-xs text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </SidebarFooter>
      </Sidebar>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </>
  );
}
