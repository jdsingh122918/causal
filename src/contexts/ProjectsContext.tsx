import React, { createContext, useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Project, CreateProjectRequest } from "@/lib/types";

interface ProjectsContextType {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  createProject: (request: CreateProjectRequest) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsList = await invoke<Project[]>("list_projects");
      setProjects(projectsList);

      // Try to load the current project ID
      try {
        const currentProjectId = await invoke<string | null>("get_current_project");
        if (currentProjectId && projectsList.length > 0) {
          const current = projectsList.find((p) => p.id === currentProjectId);
          setCurrentProject(current || null);
        } else {
          setCurrentProject(null);
        }
      } catch (error) {
        // No current project set
        setCurrentProject(null);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (request: CreateProjectRequest) => {
    try {
      const newProject = await invoke<Project>("create_project", { request });
      setProjects((prev) => [...prev, newProject]);
      setCurrentProject(newProject);
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  };

  const selectProject = async (projectId: string) => {
    try {
      await invoke("set_current_project", { projectId });
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
      }
    } catch (error) {
      console.error("Failed to select project:", error);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await invoke("delete_project", { projectId });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      throw error;
    }
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        currentProject,
        loading,
        createProject,
        selectProject,
        loadProjects,
        deleteProject,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within ProjectsProvider");
  }
  return context;
}
