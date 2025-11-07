import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Project, CreateProjectRequest, IntelligenceConfig } from "@/lib/types";
import * as tauri from "@/lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import { useProjectEvents } from "@/hooks/use-realtime-events";
import { logger } from "@/utils/logger";

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
  refreshCurrentProject: () => Promise<void>;
  updateProjectIntelligence: (projectId: string, config: IntelligenceConfig) => Promise<void>;
  getProjectIntelligence: (projectId?: string) => IntelligenceConfig | null;

  // Per-project API key management
  setProjectApiKey: (projectId: string, apiKey: string) => Promise<void>;
  getProjectApiKey: (projectId: string) => Promise<string | null>;
  deleteProjectApiKey: (projectId: string) => Promise<void>;
  hasProjectApiKey: (projectId: string) => Promise<boolean>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimisticOperations, setOptimisticOperations] = useState<Map<string, Project>>(new Map());

  // Real-time event handlers
  const handleProjectCreated = useCallback((project: Project) => {
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
    setProjects((prev) => prev.map(p => p.id === project.id ? project : p));

    // Update current project if it's the one that was updated
    setCurrentProject(current => current?.id === project.id ? project : current);
  }, []);

  const handleProjectDeleted = useCallback((payload: { id: string }) => {
    setProjects((prev) => prev.filter(p => p.id !== payload.id));

    // Clear current project if it's the one that was deleted
    setCurrentProject(current => current?.id === payload.id ? null : current);
  }, []);

  const handleCurrentProjectChanged = useCallback((payload: { project_id: string | null }) => {
    if (payload.project_id) {
      // Try to find project in current projects list
      const project = projects.find(p => p.id === payload.project_id);
      if (project) {
        setCurrentProject(project);
      } else {
        // Project not found in current list, fetch it directly
        tauri.getCurrentProject()
          .then((currentProject) => {
            setCurrentProject(currentProject);
          })
          .catch((error) => {
            logger.error("Projects", "Failed to fetch current project:", error);
            setCurrentProject(null);
          });
      }
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
        setCurrentProject(currentProject);

        // If backend has no current project but we have projects, try to restore from localStorage
        if (!currentProject && projectsList.length > 0) {
          const lastSelectedProjectId = localStorage.getItem("causal_last_selected_project");
          if (lastSelectedProjectId) {
            const lastProject = projectsList.find(p => p.id === lastSelectedProjectId);
            if (lastProject) {
              logger.debug("Projects", `Restoring last selected project: ${lastProject.name}`);
              // Set backend state
              await tauri.selectProject(lastProject.id);
              setCurrentProject(lastProject);
            }
          }
        } else if (currentProject) {
          // Store the current project ID for future restoration
          localStorage.setItem("causal_last_selected_project", currentProject.id);
        }
      } catch (error) {
        // No current project set - try to restore from localStorage
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.debug("Projects", "No current project:", errorMessage);

        if (projectsList.length > 0) {
          const lastSelectedProjectId = localStorage.getItem("causal_last_selected_project");
          if (lastSelectedProjectId) {
            const lastProject = projectsList.find(p => p.id === lastSelectedProjectId);
            if (lastProject) {
              logger.debug("Projects", `Restoring last selected project after error: ${lastProject.name}`);
              try {
                await tauri.selectProject(lastProject.id);
                setCurrentProject(lastProject);
              } catch (selectError) {
                logger.error("Projects", "Failed to restore last selected project:", selectError);
                setCurrentProject(null);
              }
            } else {
              setCurrentProject(null);
            }
          } else {
            setCurrentProject(null);
          }
        } else {
          setCurrentProject(null);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Projects", "Failed to load projects:", errorMessage);
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
      logger.error("Projects", "Failed to refresh projects:", errorMessage);
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
      logger.error("Projects", "Failed to create project:", errorMessage);
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

      // Persist to localStorage for restoration after app restart
      localStorage.setItem("causal_last_selected_project", projectId);
    } catch (error) {
      // Revert optimistic update on error
      try {
        const actualCurrentProject = await tauri.getCurrentProject();
        setCurrentProject(actualCurrentProject);
      } catch {
        setCurrentProject(null);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Projects", "Failed to select project:", errorMessage);
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
      // Clear from localStorage if this was the last selected project
      const lastSelectedProjectId = localStorage.getItem("causal_last_selected_project");
      if (lastSelectedProjectId === projectId) {
        localStorage.removeItem("causal_last_selected_project");
      }
    }

    try {
      // Real deletion will be confirmed via real-time event
      await tauri.deleteProject(projectId);
    } catch (error) {
      // Rollback optimistic changes on error
      setProjects(originalProjects);
      setCurrentProject(originalCurrentProject);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Projects", "Failed to delete project:", errorMessage);
      throw error;
    }
  };

  const refreshCurrentProject = async () => {
    try {
      const currentProject = await tauri.getCurrentProject();
      setCurrentProject(currentProject);
    } catch (error) {
      setCurrentProject(null);
    }
  };

  // Business Intelligence Configuration Methods
  const getProjectIntelligenceKey = (projectId: string) => `causal-project-intelligence-${projectId}`;

  const updateProjectIntelligence = async (projectId: string, config: IntelligenceConfig) => {
    try {
      // Store BI config in localStorage
      const key = getProjectIntelligenceKey(projectId);
      localStorage.setItem(key, JSON.stringify(config));

      // Update the project in state if it's loaded
      setProjects(prev => prev.map(project =>
        project.id === projectId
          ? { ...project, intelligence: config }
          : project
      ));

      // Update current project if it's the one being modified
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, intelligence: config } : prev);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Projects", "Failed to update project intelligence config:", errorMessage);
      throw error;
    }
  };

  const getProjectIntelligence = (projectId?: string): IntelligenceConfig | null => {
    const targetProjectId = projectId || currentProject?.id;
    if (!targetProjectId) return null;

    try {
      // First check if project has intelligence config in state
      const project = projects.find(p => p.id === targetProjectId) || currentProject;
      if (project?.intelligence) {
        return project.intelligence;
      }

      // Fall back to localStorage
      const key = getProjectIntelligenceKey(targetProjectId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const config = JSON.parse(stored) as IntelligenceConfig;

        // Migration: Add "Risk" analysis if it's missing from old configurations
        const allAnalysisTypes = ["Sentiment", "Financial", "Competitive", "Summary", "Risk"];
        const hasAllTypes = allAnalysisTypes.every(type => config.analyses.includes(type as any));

        if (!hasAllTypes) {
          logger.debug("Projects", `Migrating project ${targetProjectId} intelligence config to include all analysis types`);
          const migratedConfig = {
            ...config,
            analyses: allAnalysisTypes as any
          };

          // Save the migrated config back to localStorage
          localStorage.setItem(key, JSON.stringify(migratedConfig));
          return migratedConfig;
        }

        return config;
      }

      // Return default config if none exists
      return {
        enabled: false,
        analyses: ["Sentiment", "Financial", "Competitive", "Summary", "Risk"],
        autoAnalyze: true,
        analysisFrequency: "sentence",
      };
    } catch (error) {
      logger.error("Projects", "Failed to get project intelligence config:", error);
      return null;
    }
  };

  // Per-project API key management functions
  const setProjectApiKey = async (projectId: string, apiKey: string) => {
    // Validate input parameters
    if (!projectId || typeof projectId !== 'string') {
      throw new Error("Invalid project ID provided");
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error("Invalid API key provided");
    }

    try {
      // Call backend to save to secure storage
      await invoke("save_project_api_key", {
        projectId: projectId,
        apiKey: apiKey
      });

      // Update project state to indicate API key is configured
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, apiKeyConfigured: true }
          : p
      ));

      // Update current project if it's the one being modified
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, apiKeyConfigured: true } : prev);
      }

      logger.info("Projects", `API key saved for project: ${projectId}`);
    } catch (error) {
      logger.error("Projects", "Failed to save project API key:", error);
      throw error;
    }
  };

  const getProjectApiKey = async (projectId: string): Promise<string | null> => {
    // Validate input parameter
    if (!projectId || typeof projectId !== 'string') {
      logger.warn("Projects", "Invalid project ID provided to getProjectApiKey:", projectId);
      return null;
    }

    try {
      const apiKey = await invoke<string | null>("load_project_api_key", {
        projectId: projectId
      });
      return apiKey || null;
    } catch (error) {
      logger.warn("Projects", "Failed to load project API key:", error);
      return null;
    }
  };

  const deleteProjectApiKey = async (projectId: string): Promise<void> => {
    // Validate input parameter
    if (!projectId || typeof projectId !== 'string') {
      throw new Error("Invalid project ID provided");
    }

    try {
      await invoke("delete_project_api_key", {
        projectId: projectId
      });

      // Update project state to indicate API key is no longer configured
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, apiKeyConfigured: false }
          : p
      ));

      // Update current project if it's the one being modified
      if (currentProject?.id === projectId) {
        setCurrentProject(prev => prev ? { ...prev, apiKeyConfigured: false } : prev);
      }

      logger.info("Projects", `API key deleted for project: ${projectId}`);
    } catch (error) {
      logger.error("Projects", "Failed to delete project API key:", error);
      throw error;
    }
  };

  const hasProjectApiKey = async (projectId: string): Promise<boolean> => {
    // Validate input parameter
    if (!projectId || typeof projectId !== 'string') {
      logger.warn("Projects", "Invalid project ID provided to hasProjectApiKey:", projectId);
      return false;
    }

    try {
      const exists = await invoke<boolean>("project_api_key_exists", {
        projectId: projectId
      });
      return exists;
    } catch (error) {
      logger.warn("Projects", "Failed to check project API key existence:", error);
      return false;
    }
  };

  // Load intelligence configs for all projects on mount
  useEffect(() => {
    const loadIntelligenceConfigs = () => {
      setProjects(prev => prev.map(project => {
        if (!project.intelligence) {
          const config = getProjectIntelligence(project.id);
          return config ? { ...project, intelligence: config } : project;
        }
        return project;
      }));
    };

    if (projects.length > 0) {
      loadIntelligenceConfigs();
    }
  }, [projects.length]); // Only run when projects are first loaded

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
        refreshCurrentProject,
        updateProjectIntelligence,
        getProjectIntelligence,

        // Per-project API key management
        setProjectApiKey,
        getProjectApiKey,
        deleteProjectApiKey,
        hasProjectApiKey,
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
