import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Project, CreateProjectRequest } from "@/lib/types";
import * as tauri from "@/lib/tauri";
import { useProjectEvents } from "@/hooks/use-realtime-events";

interface ProjectsContextType {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  optimisticOperations: Map<string, Project>;
  createProject: (request: CreateProjectRequest) => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimisticOperations, setOptimisticOperations] = useState<Map<string, Project>>(new Map());

  // Real-time event handlers
  const handleProjectCreated = useCallback((project: Project) => {
    console.log('Project created via real-time event:', project);
    setProjects((prev) => {
      // Check if project already exists to avoid duplicates
      const exists = prev.some(p => p.id === project.id);
      if (exists) return prev;
      return [...prev, project];
    });

    // Remove any optimistic operation
    setOptimisticOperations(prev => {
      const next = new Map(prev);
      // Find and remove any optimistic project with matching name
      for (const [key, optimisticProject] of prev) {
        if (optimisticProject.name === project.name) {
          next.delete(key);
          break;
        }
      }
      return next;
    });
  }, []);

  const handleProjectUpdated = useCallback((project: Project) => {
    console.log('Project updated via real-time event:', project);
    setProjects((prev) => prev.map(p => p.id === project.id ? project : p));

    // Update current project if it's the one that was updated
    setCurrentProject(current => current?.id === project.id ? project : current);
  }, []);

  const handleProjectDeleted = useCallback((payload: { id: string }) => {
    console.log('Project deleted via real-time event:', payload.id);
    setProjects((prev) => prev.filter(p => p.id !== payload.id));

    // Clear current project if it's the one that was deleted
    setCurrentProject(current => current?.id === payload.id ? null : current);
  }, []);

  const handleCurrentProjectChanged = useCallback((payload: { project_id: string | null }) => {
    console.log('Current project changed via real-time event:', payload.project_id);
    if (payload.project_id) {
      const project = projects.find(p => p.id === payload.project_id);
      setCurrentProject(project || null);
    } else {
      setCurrentProject(null);
    }
  }, [projects]);

  // Set up real-time event listeners
  useProjectEvents({
    onProjectCreated: handleProjectCreated,
    onProjectUpdated: handleProjectUpdated,
    onProjectDeleted: handleProjectDeleted,
    onCurrentProjectChanged: handleCurrentProjectChanged,
  });

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsList = await tauri.listProjects();
      setProjects(projectsList);

      // Try to load the current project
      try {
        const currentProject = await tauri.getCurrentProject();
        if (currentProject) {
          setCurrentProject(currentProject);
        } else {
          setCurrentProject(null);
        }
      } catch (error) {
        // No current project set - expected when no project is selected
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.debug("No current project:", errorMessage);
        setCurrentProject(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to load projects:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshProjects = useCallback(async () => {
    // Non-loading refresh for real-time updates
    try {
      const projectsList = await tauri.listProjects();
      setProjects(projectsList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to refresh projects:", errorMessage);
    }
  }, []);

  const createProject = async (request: CreateProjectRequest) => {
    // Generate optimistic ID
    const optimisticId = `temp-${Date.now()}`;
    const optimisticProject: Project = {
      id: optimisticId,
      name: request.name,
      description: request.description,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    // Add optimistic update
    setOptimisticOperations(prev => new Map(prev).set(optimisticId, optimisticProject));

    try {
      // The real project will be added via real-time event
      await tauri.createProject(request);
    } catch (error) {
      // Remove optimistic update on error
      setOptimisticOperations(prev => {
        const next = new Map(prev);
        next.delete(optimisticId);
        return next;
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to create project:", errorMessage);
      throw error;
    }
  };

  const selectProject = async (projectId: string) => {
    try {
      // Optimistically update current project
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
      }

      // Backend call will trigger real-time event for confirmation
      await tauri.selectProject(projectId);
    } catch (error) {
      // Revert optimistic update on error
      try {
        const actualCurrentProject = await tauri.getCurrentProject();
        setCurrentProject(actualCurrentProject);
      } catch {
        setCurrentProject(null);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to select project:", errorMessage);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    // Store original state for potential rollback
    const originalProjects = projects;
    const originalCurrentProject = currentProject;

    // Optimistically remove project
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
    }

    try {
      // Real deletion will be confirmed via real-time event
      await tauri.deleteProject(projectId);
    } catch (error) {
      // Rollback optimistic changes on error
      setProjects(originalProjects);
      setCurrentProject(originalCurrentProject);

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to delete project:", errorMessage);
      throw error;
    }
  };

  // Combine real projects with optimistic operations for display
  const displayProjects = [
    ...projects,
    ...Array.from(optimisticOperations.values())
  ];

  return (
    <ProjectsContext.Provider
      value={{
        projects: displayProjects,
        currentProject,
        loading,
        optimisticOperations,
        createProject,
        selectProject,
        loadProjects,
        deleteProject,
        refreshProjects,
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
