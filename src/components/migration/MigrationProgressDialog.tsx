import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Zap,
  Clock,
  FileText,
  Users,
  MessageSquare
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MigrationReport {
  total_projects: number;
  total_recordings: number;
  migrated_projects: number;
  migrated_recordings: number;
  embeddings_generated: number;
  errors: string[];
  warnings: string[];
  duration_seconds: number;
  data_integrity_checks: {
    projects_match: boolean;
    recordings_match: boolean;
    content_preserved: boolean;
  };
}

interface ValidationReport {
  source_counts: {
    projects: number;
    recordings: number;
  };
  target_counts: {
    projects: number;
    recordings: number;
  };
  data_integrity: {
    projects_match: boolean;
    recordings_match: boolean;
    content_preserved: boolean;
  };
  issues: string[];
  recommendations: string[];
}

interface MigrationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MigrationStep =
  | 'preparation'
  | 'validation'
  | 'migration'
  | 'verification'
  | 'complete'
  | 'error';

interface StepInfo {
  id: MigrationStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MIGRATION_STEPS: StepInfo[] = [
  {
    id: 'preparation',
    title: 'Preparation',
    description: 'Checking system readiness and MongoDB connection',
    icon: Database
  },
  {
    id: 'validation',
    title: 'Pre-Migration Validation',
    description: 'Validating source data and target configuration',
    icon: CheckCircle2
  },
  {
    id: 'migration',
    title: 'Data Migration',
    description: 'Migrating projects, recordings, and generating embeddings',
    icon: Upload
  },
  {
    id: 'verification',
    title: 'Post-Migration Verification',
    description: 'Verifying data integrity and completeness',
    icon: FileText
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Migration completed successfully',
    icon: CheckCircle2
  }
];

export function MigrationProgressDialog({ open, onOpenChange }: MigrationProgressDialogProps) {
  const [currentStep, setCurrentStep] = useState<MigrationStep>('preparation');
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [canStart, setCanStart] = useState(false);

  // Check if migration can start
  const checkReadiness = useCallback(async () => {
    try {
      addLog("Checking MongoDB initialization status...");
      const isInitialized = await invoke<boolean>("is_mongo_initialized");

      if (!isInitialized) {
        setError("MongoDB is not initialized. Please configure MongoDB Atlas in Settings first.");
        setCanStart(false);
        return;
      }

      addLog("MongoDB is ready for migration");

      // Get MongoDB status for additional info
      const status = await invoke<any>("get_mongo_status");
      if (status?.initialized) {
        addLog(`Connected to database: ${status.database_stats?.name || 'causal_production'}`);
        setCanStart(true);
      } else {
        setError("MongoDB connection issues detected.");
        setCanStart(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check readiness";
      setError(errorMsg);
      addLog(`Error: ${errorMsg}`);
      setCanStart(false);
    }
  }, []);

  // Add log entry
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Check readiness when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('preparation');
      setProgress(0);
      setLogs([]);
      setError(null);
      setMigrationReport(null);
      setValidationReport(null);
      checkReadiness();
    }
  }, [open, checkReadiness]);

  // Perform pre-migration validation
  const performValidation = useCallback(async () => {
    setCurrentStep('validation');
    setProgress(10);
    addLog("Starting pre-migration validation...");

    try {
      const validation = await invoke<ValidationReport>("validate_migration");
      setValidationReport(validation);

      addLog(`Found ${validation.source_counts.projects} projects and ${validation.source_counts.recordings} recordings in SQLite`);

      if (validation.issues.length > 0) {
        addLog("Validation issues detected:");
        validation.issues.forEach(issue => addLog(`  - ${issue}`));
      }

      if (validation.recommendations.length > 0) {
        addLog("Recommendations:");
        validation.recommendations.forEach(rec => addLog(`  - ${rec}`));
      }

      setProgress(20);
      addLog("Pre-migration validation completed");
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Validation failed";
      setError(errorMsg);
      addLog(`Validation error: ${errorMsg}`);
      setCurrentStep('error');
      return false;
    }
  }, [addLog]);

  // Perform migration
  const performMigration = useCallback(async () => {
    setCurrentStep('migration');
    setProgress(30);
    addLog("Starting data migration...");

    try {
      // Start migration
      const report = await invoke<MigrationReport>("migrate_sqlite_to_mongo");
      setMigrationReport(report);

      // Log migration results
      addLog(`Migration completed in ${report.duration_seconds.toFixed(1)} seconds`);
      addLog(`Migrated ${report.migrated_projects}/${report.total_projects} projects`);
      addLog(`Migrated ${report.migrated_recordings}/${report.total_recordings} recordings`);
      addLog(`Generated ${report.embeddings_generated} embeddings for semantic search`);

      if (report.errors.length > 0) {
        addLog("Migration errors:");
        report.errors.forEach(error => addLog(`  - ${error}`));
      }

      if (report.warnings.length > 0) {
        addLog("Migration warnings:");
        report.warnings.forEach(warning => addLog(`  - ${warning}`));
      }

      setProgress(80);
      return report.errors.length === 0;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Migration failed";
      setError(errorMsg);
      addLog(`Migration error: ${errorMsg}`);
      setCurrentStep('error');
      return false;
    }
  }, [addLog]);

  // Perform post-migration verification
  const performVerification = useCallback(async () => {
    setCurrentStep('verification');
    setProgress(85);
    addLog("Starting post-migration verification...");

    try {
      // Re-run validation to check target state
      const postValidation = await invoke<ValidationReport>("validate_migration");

      addLog(`Verified ${postValidation.target_counts.projects} projects in MongoDB`);
      addLog(`Verified ${postValidation.target_counts.recordings} recordings in MongoDB`);

      if (postValidation.data_integrity.projects_match &&
          postValidation.data_integrity.recordings_match &&
          postValidation.data_integrity.content_preserved) {
        addLog("✅ Data integrity verification passed");
        setProgress(100);
        setCurrentStep('complete');
        addLog("Migration completed successfully!");
        return true;
      } else {
        addLog("❌ Data integrity verification failed");
        setError("Data integrity check failed. Some data may not have migrated correctly.");
        setCurrentStep('error');
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Verification failed";
      setError(errorMsg);
      addLog(`Verification error: ${errorMsg}`);
      setCurrentStep('error');
      return false;
    }
  }, [addLog]);

  // Start migration process
  const startMigration = useCallback(async () => {
    if (!canStart) return;

    setIsRunning(true);
    setError(null);

    try {
      // Step 1: Validation
      const validationSuccess = await performValidation();
      if (!validationSuccess) return;

      // Step 2: Migration
      const migrationSuccess = await performMigration();
      if (!migrationSuccess) return;

      // Step 3: Verification
      await performVerification();

      toast.success("Migration completed successfully!");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Migration failed";
      setError(errorMsg);
      setCurrentStep('error');
      toast.error("Migration failed: " + errorMsg);
    } finally {
      setIsRunning(false);
    }
  }, [canStart, performValidation, performMigration, performVerification]);

  const getStepStatus = (stepId: MigrationStep): 'pending' | 'current' | 'completed' | 'error' => {
    const stepIndex = MIGRATION_STEPS.findIndex(s => s.id === stepId);
    const currentIndex = MIGRATION_STEPS.findIndex(s => s.id === currentStep);

    if (currentStep === 'error') {
      return stepIndex <= currentIndex ? 'error' : 'pending';
    }

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const getStepIcon = (step: StepInfo, status: string) => {
    const Icon = step.icon;
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === 'current') return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            SQLite to MongoDB Migration
          </DialogTitle>
          <DialogDescription>
            Migrate your data to MongoDB Atlas with enhanced RAG capabilities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Migration Steps */}
          <div className="space-y-3">
            {MIGRATION_STEPS.map((step) => {
              const status = getStepStatus(step.id);
              return (
                <div key={step.id} className="flex items-center gap-3">
                  {getStepIcon(step, status)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                  {status === 'completed' && (
                    <Badge variant="secondary" className="text-xs">Complete</Badge>
                  )}
                  {status === 'current' && (
                    <Badge variant="default" className="text-xs">In Progress</Badge>
                  )}
                  {status === 'error' && (
                    <Badge variant="destructive" className="text-xs">Error</Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Migration Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Summary Information */}
          {(validationReport || migrationReport) && (
            <div className="space-y-4">
              {validationReport && (
                <div className="p-4 border rounded-lg space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Data Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Projects
                      </span>
                      <Badge variant="outline">{validationReport.source_counts.projects}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Recordings
                      </span>
                      <Badge variant="outline">{validationReport.source_counts.recordings}</Badge>
                    </div>
                  </div>
                </div>
              )}

              {migrationReport && (
                <div className="p-4 border rounded-lg space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Migration Results
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Duration</span>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {migrationReport.duration_seconds.toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Embeddings</span>
                      <Badge variant="outline">
                        <Zap className="h-3 w-3 mr-1" />
                        {migrationReport.embeddings_generated}
                      </Badge>
                    </div>
                  </div>

                  {migrationReport.data_integrity_checks && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                        Data Integrity
                      </h5>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className={cn(
                          "flex items-center gap-1",
                          migrationReport.data_integrity_checks.projects_match ? "text-green-600" : "text-red-600"
                        )}>
                          {migrationReport.data_integrity_checks.projects_match ?
                            <CheckCircle2 className="h-3 w-3" /> :
                            <AlertCircle className="h-3 w-3" />
                          }
                          Projects
                        </div>
                        <div className={cn(
                          "flex items-center gap-1",
                          migrationReport.data_integrity_checks.recordings_match ? "text-green-600" : "text-red-600"
                        )}>
                          {migrationReport.data_integrity_checks.recordings_match ?
                            <CheckCircle2 className="h-3 w-3" /> :
                            <AlertCircle className="h-3 w-3" />
                          }
                          Recordings
                        </div>
                        <div className={cn(
                          "flex items-center gap-1",
                          migrationReport.data_integrity_checks.content_preserved ? "text-green-600" : "text-red-600"
                        )}>
                          {migrationReport.data_integrity_checks.content_preserved ?
                            <CheckCircle2 className="h-3 w-3" /> :
                            <AlertCircle className="h-3 w-3" />
                          }
                          Content
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Logs */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Migration Log</h4>
            <ScrollArea className="h-32 border rounded-lg p-3">
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono text-muted-foreground">
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">
                    Migration logs will appear here...
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            {currentStep === 'complete' ? 'Close' : 'Cancel'}
          </Button>

          {currentStep !== 'complete' && currentStep !== 'error' && (
            <Button
              onClick={startMigration}
              disabled={!canStart || isRunning}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Start Migration
                </>
              )}
            </Button>
          )}

          {currentStep === 'complete' && (
            <Button
              onClick={() => {
                // Could open semantic search or other next steps
                onOpenChange(false);
                toast.success("You can now use semantic search with your migrated data!");
              }}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Explore Semantic Search
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}