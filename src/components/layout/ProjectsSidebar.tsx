import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "@/contexts/ProjectsContext";
import { Plus, Folder, Settings, Bug, MoreHorizontal, Trash2 } from "lucide-react";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
import { DeleteProjectDialog } from "@/components/dialogs/DeleteProjectDialog";
import { cn } from "@/lib/utils";
import { Project } from "@/lib/types";

export function ProjectsSidebar() {
  const { projects, currentProject, selectProject } = useProjects();
  const navigate = useNavigate();
  const location = useLocation();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteProjectOpen(true);
  };

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    navigate('/');
  };

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
                      <div className="flex items-center w-full group">
                        <SidebarMenuButton
                          onClick={() => handleProjectSelect(project.id)}
                          isActive={currentProject?.id === project.id}
                          className={cn(
                            "flex-1 justify-start",
                            currentProject?.id === project.id &&
                              "bg-accent font-medium"
                          )}
                        >
                          <Folder className="h-4 w-4" />
                          <span className="truncate">{project.name}</span>
                        </SidebarMenuButton>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 shrink-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDeleteProject(project)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/settings')}
                    isActive={location.pathname === '/settings'}
                    className={cn(
                      "w-full justify-start",
                      location.pathname === '/settings' && "bg-accent font-medium"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate('/diagnostics')}
                    isActive={location.pathname === '/diagnostics'}
                    className={cn(
                      "w-full justify-start",
                      location.pathname === '/diagnostics' && "bg-accent font-medium"
                    )}
                  >
                    <Bug className="h-4 w-4" />
                    <span>Diagnostics & Logs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
      <DeleteProjectDialog
        project={projectToDelete}
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
      />
    </>
  );
}
