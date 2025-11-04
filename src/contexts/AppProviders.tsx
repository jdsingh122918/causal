import React from "react";
import { ThemeProvider } from "./ThemeProvider";
import { SettingsProvider } from "./SettingsContext";
import { ProjectsProvider } from "./ProjectsContext";
import { RecordingsProvider } from "./RecordingsContext";
import { TranscriptionProvider } from "./TranscriptionContext";
import { Toaster } from "@/components/ui/sonner";

/**
 * AppProviders wraps all context providers in the correct order.
 * ThemeProvider must be at the top to ensure theme is applied before any components render.
 * Settings and Projects are independent, but Recordings depends on Projects,
 * and Transcription is independent.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ProjectsProvider>
          <RecordingsProvider>
            <TranscriptionProvider>
              {children}
              <Toaster />
            </TranscriptionProvider>
          </RecordingsProvider>
        </ProjectsProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
