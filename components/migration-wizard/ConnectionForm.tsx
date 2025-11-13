"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ConnectionFormProps {
  role: "source_ee" | "target_ce";
  title: string;
  description: string;
  onConnectionAdded: () => void;
}

export default function ConnectionForm({ role, title, description, onConnectionAdded }: ConnectionFormProps) {
  const [formData, setFormData] = useState({
    host: "localhost",
    port: "54132",
    database: "",
    username: "azure",
    password: "",
  });

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
    serverVersion?: string;
  } | null>(null);

  // Load existing connection data on mount and test connection
  useEffect(() => {
    const loadExistingConnection = async () => {
      try {
        const response = await fetch("/api/connections");
        const data = await response.json();
        const existingConnection = data.data?.find((conn: { role: string }) => conn.role === role);
        
        if (existingConnection) {
          const formDataToSet = {
            host: existingConnection.host,
            port: existingConnection.port.toString(),
            database: existingConnection.database,
            username: existingConnection.username,
            password: existingConnection.password || "",
          };
          setFormData(formDataToSet);
          
          // Auto-test the connection if credentials exist
          if (existingConnection.password) {
            setLoading(false);
            setSaving(true);
            
            try {
              const testResponse = await fetch("/api/connections/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  host: existingConnection.host,
                  port: existingConnection.port,
                  database: existingConnection.database,
                  username: existingConnection.username,
                  password: existingConnection.password,
                }),
              });

              const testData = await testResponse.json();
              setSaveResult({
                success: testData.success,
                message: testData.success 
                  ? "Connection verified successfully" 
                  : `Connection test failed: ${testData.message}`,
                serverVersion: testData.serverVersion,
              });
            } catch (error) {
              setSaveResult({
                success: false,
                message: error instanceof Error ? error.message : "Failed to test connection",
              });
            } finally {
              setSaving(false);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load existing connection:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingConnection();
  }, [role]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveResult(null);
  };

  const handleTestAndSave = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const connectionName = role === "source_ee" ? "Source Database (Odoo EE)" : "Target Database (Odoo CE)";
      
      // Check if connection already exists for this role
      const existingResponse = await fetch("/api/connections");
      const existingData = await existingResponse.json();
      const existingConnection = existingData.data?.find((conn: { role: string; id: number }) => conn.role === role);
      
      // POST endpoint tests connection first, then saves if successful
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          name: connectionName, 
          role,
          ...(existingConnection && { id: existingConnection.id })
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSaveResult({
          success: true,
          message: data.message || "Connection tested and saved successfully",
          serverVersion: data.data?.serverVersion,
        });
        onConnectionAdded();
      } else {
        setSaveResult({
          success: false,
          message: data.error || "Failed to save connection",
        });
      }
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to save connection",
      });
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = formData.host && formData.port && formData.database && formData.username && formData.password;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading connection data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor={`host-${role}`}>Host</Label>
            <Input
              id={`host-${role}`}
              placeholder="localhost"
              value={formData.host}
              onChange={(e) => handleInputChange("host", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`port-${role}`}>Port</Label>
            <Input
              id={`port-${role}`}
              type="number"
              placeholder="54132"
              value={formData.port}
              onChange={(e) => handleInputChange("port", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`database-${role}`}>Database Name</Label>
          <Input
            id={`database-${role}`}
            placeholder="odoo_production"
            value={formData.database}
            onChange={(e) => handleInputChange("database", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`username-${role}`}>Username</Label>
            <Input
              id={`username-${role}`}
              placeholder="azure"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`password-${role}`}>Password</Label>
            <Input
              id={`password-${role}`}
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
            />
          </div>
        </div>

        {/* Result */}
        {saveResult && (
          <Alert variant={saveResult.success ? "default" : "destructive"}>
            <AlertDescription className="flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {saveResult.success ? "✅ Connection Successful" : "❌ Connection Failed"}
                </div>
                <div className="text-sm mt-1">{saveResult.message}</div>
                {saveResult.success && saveResult.serverVersion && (
                  <div className="text-xs mt-1 opacity-75">
                    PostgreSQL Server: {saveResult.serverVersion}
                  </div>
                )}
              </div>
              {saveResult.success && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        <div className="pt-4">
          <Button
            type="button"
            onClick={handleTestAndSave}
            disabled={!isFormValid || saving}
            className="w-full"
          >
            {saving ? "Testing & Saving..." : "Test & Save Connection"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          💡 Connection will be tested before saving
        </p>
      </CardContent>
    </Card>
  );
}
