import { type ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { SettingsProvider } from "./SettingsContext";
import { ProjectsProvider } from "./ProjectsContext";
import { RecordingsProvider } from "./RecordingsContext";
import { TranscriptionProvider } from "./TranscriptionContext";
import { NavigationProvider } from "./NavigationContext";
import { IntelligenceProvider } from "./IntelligenceContext";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

/**
 * Enhanced error boundary component for each provider layer
 */
function ProviderErrorBoundary({
  children,
  name
}: {
  children: ReactNode;
  name: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="max-w-md p-6 text-center">
            <h2 className="mb-2 text-xl font-bold text-red-600">
              {name} Provider Error
            </h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the {name.toLowerCase()} system.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Application
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * AppProviders wraps all context providers in the correct order with error boundaries.
 * ThemeProvider must be at the top to ensure theme is applied before any components render.
 * NavigationProvider is independent and can be placed early.
 * Settings and Projects are independent, but Recordings depends on Projects,
 * and Transcription is independent.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  try {
    return (
      <ProviderErrorBoundary name="Theme">
        <ThemeProvider>
          <ProviderErrorBoundary name="Navigation">
            <NavigationProvider>
              <ProviderErrorBoundary name="Settings">
                <SettingsProvider>
                  <ProviderErrorBoundary name="Projects">
                    <ProjectsProvider>
                      <ProviderErrorBoundary name="Recordings">
                        <RecordingsProvider>
                          <ProviderErrorBoundary name="Transcription">
                            <TranscriptionProvider>
                              <ProviderErrorBoundary name="Intelligence">
                                <IntelligenceProvider>
                                  {children}
                                  <Toaster />
                                </IntelligenceProvider>
                              </ProviderErrorBoundary>
                            </TranscriptionProvider>
                          </ProviderErrorBoundary>
                        </RecordingsProvider>
                      </ProviderErrorBoundary>
                    </ProjectsProvider>
                  </ProviderErrorBoundary>
                </SettingsProvider>
              </ProviderErrorBoundary>
            </NavigationProvider>
          </ProviderErrorBoundary>
        </ThemeProvider>
      </ProviderErrorBoundary>
    );
  } catch (error) {
    console.error("❌ AppProviders: Critical error during provider setup:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Return a basic error fallback
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md p-6 text-center">
          <h2 className="mb-2 text-xl font-bold text-red-600">
            Application Error
          </h2>
          <p className="text-gray-600 mb-4">
            There was a critical error loading the application providers.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }
}
