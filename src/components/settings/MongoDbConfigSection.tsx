import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ExternalLink,
  Shield,
  Zap,
  Settings2
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

interface MongoConfig {
  connection_string: string;
  database_name: string;
  atlas_api_key: string;
  project_id: string;
  cluster_name: string;
  search_index_name: string;
}

interface ConnectionTestResult {
  connection_successful: boolean;
  database_accessible: boolean;
  vector_search_available: boolean;
  atlas_api_authenticated: boolean;
  index_configured: boolean;
  errors: string[];
  warnings: string[];
}

export function MongoDbConfigSection() {

  const [config, setConfig] = useState<MongoConfig>({
    connection_string: "",
    database_name: "causal_production",
    atlas_api_key: "",
    project_id: "",
    cluster_name: "",
    search_index_name: "vector_index",
  });

  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [loading, setLoading] = useState({
    test: false,
    save: false,
    load: false,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleConfigChange = (field: keyof MongoConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setTestResult(null); // Clear test results when config changes
  };

  const loadExistingConfig = async () => {
    setLoading(prev => ({ ...prev, load: true }));
    try {
      const existingConfig = await invoke<MongoConfig | null>("load_mongo_config");
      if (existingConfig) {
        setConfig(existingConfig);
        toast.success("MongoDB configuration loaded");
      } else {
        toast.info("No existing MongoDB configuration found");
      }
    } catch (error) {
      toast.error("Failed to load MongoDB configuration");
    } finally {
      setLoading(prev => ({ ...prev, load: false }));
    }
  };

  const testConnection = async () => {
    setLoading(prev => ({ ...prev, test: true }));
    try {
      const result = await invoke<ConnectionTestResult>("test_mongo_connection", { config });
      setTestResult(result);

      if (result.connection_successful && result.database_accessible) {
        toast.success("MongoDB connection successful!");
      } else {
        toast.error(`Connection failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      toast.error(`Connection test failed: ${error}`);
      console.error("MongoDB connection test error:", error);
    } finally {
      setLoading(prev => ({ ...prev, test: false }));
    }
  };

  const saveConfiguration = async () => {
    setLoading(prev => ({ ...prev, save: true }));
    try {
      await invoke<string>("save_mongo_config", { config });
      toast.success("MongoDB configuration saved!");
      setHasChanges(false);
    } catch (error) {
      toast.error(`Failed to save configuration: ${error}`);
      console.error("MongoDB configuration save error:", error);
    } finally {
      setLoading(prev => ({ ...prev, save: false }));
    }
  };

  const getStatusBadge = () => {
    if (!testResult) return null;

    if (testResult.connection_successful && testResult.database_accessible && testResult.index_configured) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
    } else if (testResult.connection_successful) {
      return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Needs Setup</Badge>;
    } else {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Not Connected</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">MongoDB Atlas (RAG)</h3>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-xs">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open('https://cloud.mongodb.com/', '_blank')}
            className="h-6 px-2 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Atlas Console
          </Button>
        </div>
      </div>

      <div className="space-y-4 pl-7">
        <p className="text-sm text-muted-foreground">
          Configure MongoDB Atlas for RAG-powered semantic search and enhanced AI capabilities.
        </p>

        {/* Connection String */}
        <div className="space-y-2">
          <Label htmlFor="mongo-connection" className="text-sm font-medium flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Atlas Connection String
          </Label>
          <Input
            id="mongo-connection"
            type="password"
            placeholder="mongodb+srv://username:password@cluster.mongodb.net/"
            value={config.connection_string}
            onChange={(e) => handleConfigChange('connection_string', e.target.value)}
            className="h-11 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            MongoDB Atlas connection string with credentials
          </p>
        </div>

        {/* Atlas API Key */}
        <div className="space-y-2">
          <Label htmlFor="voyage-api-key" className="text-sm font-medium flex items-center gap-1">
            <Zap className="h-3 w-3" />
            VoyageAI API Key
          </Label>
          <Input
            id="voyage-api-key"
            type="password"
            placeholder="Enter your VoyageAI API key"
            value={config.atlas_api_key}
            onChange={(e) => handleConfigChange('atlas_api_key', e.target.value)}
            className="h-11 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            VoyageAI API key for embedding generation (voyage-2 model)
          </p>
        </div>

        {/* Advanced Configuration */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-0 h-8 text-sm">
              <Settings2 className="h-4 w-4" />
              Advanced Configuration
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database-name" className="text-sm font-medium">
                  Database Name
                </Label>
                <Input
                  id="database-name"
                  placeholder="causal_production"
                  value={config.database_name}
                  onChange={(e) => handleConfigChange('database_name', e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-index" className="text-sm font-medium">
                  Vector Search Index
                </Label>
                <Input
                  id="search-index"
                  placeholder="vector_index"
                  value={config.search_index_name}
                  onChange={(e) => handleConfigChange('search_index_name', e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project-id" className="text-sm font-medium">
                  Atlas Project ID
                </Label>
                <Input
                  id="project-id"
                  placeholder="64a1b2c3d4e5f6g7h8i9j0k1"
                  value={config.project_id}
                  onChange={(e) => handleConfigChange('project_id', e.target.value)}
                  className="h-10 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-name" className="text-sm font-medium">
                  Cluster Name
                </Label>
                <Input
                  id="cluster-name"
                  placeholder="Cluster0"
                  value={config.cluster_name}
                  onChange={(e) => handleConfigChange('cluster_name', e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Results */}
        {testResult && (
          <div className="p-3 border rounded-md space-y-2">
            <h4 className="font-medium text-sm">Connection Test Results</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`flex items-center gap-1 ${testResult.connection_successful ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.connection_successful ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                MongoDB Connection
              </div>
              <div className={`flex items-center gap-1 ${testResult.database_accessible ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.database_accessible ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                Database Access
              </div>
              <div className={`flex items-center gap-1 ${testResult.atlas_api_authenticated ? 'text-green-600' : 'text-yellow-600'}`}>
                {testResult.atlas_api_authenticated ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                VoyageAI API
              </div>
              <div className={`flex items-center gap-1 ${testResult.index_configured ? 'text-green-600' : 'text-yellow-600'}`}>
                {testResult.index_configured ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                Vector Index
              </div>
            </div>
            {testResult.errors.length > 0 && (
              <div className="text-xs text-red-600 mt-2">
                <strong>Errors:</strong> {testResult.errors.join(', ')}
              </div>
            )}
            {testResult.warnings.length > 0 && (
              <div className="text-xs text-yellow-600 mt-2">
                <strong>Warnings:</strong> {testResult.warnings.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={loadExistingConfig}
            disabled={loading.load}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {loading.load ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings2 className="h-3 w-3" />}
            Load Config
          </Button>

          <Button
            onClick={testConnection}
            disabled={loading.test || !config.connection_string}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {loading.test ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            Test Connection
          </Button>

          <Button
            onClick={saveConfiguration}
            disabled={loading.save || !hasChanges}
            size="sm"
            className="gap-2"
          >
            {loading.save ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
            Save Config
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>Note:</strong> MongoDB Atlas provides enhanced semantic search capabilities using VoyageAI embeddings.
            This enables RAG-powered analysis and intelligent content retrieval across your recordings.
          </p>
        </div>
      </div>
    </div>
  );
}