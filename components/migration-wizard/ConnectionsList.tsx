"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  role: "source_ee" | "staging" | "target_ce";
  created_at: string;
}

interface ConnectionsListProps {
  refresh: number;
}

const roleLabels = {
  source_ee: "Source EE",
  staging: "Staging",
  target_ce: "Target CE",
};

const roleColors = {
  source_ee: "bg-blue-100 text-blue-800 border-blue-200",
  staging: "bg-yellow-100 text-yellow-800 border-yellow-200",
  target_ce: "bg-green-100 text-green-800 border-green-200",
};

export default function ConnectionsList({ refresh }: ConnectionsListProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connections");
      const data = await response.json();

      if (data.success) {
        setConnections(data.data);
      } else {
        setError(data.error || "Failed to load connections");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [refresh]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this connection?")) {
      return;
    }

    setDeleting(id);
    try {
      const response = await fetch(`/api/connections?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        fetchConnections();
      } else {
        alert(data.error || "Failed to delete connection");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete connection");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configured Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading connections...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configured Connections</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>Error: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configured Connections</CardTitle>
        <CardDescription>
          {connections.length === 0
            ? "No connections configured yet. Add your first connection above."
            : `${connections.length} database connection(s) configured`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg mb-2">No connections yet</p>
            <p className="text-sm">Add your Source EE, Staging, and Target CE database connections to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Username</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">{conn.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleColors[conn.role]}>
                      {roleLabels[conn.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{conn.host}</TableCell>
                  <TableCell className="font-mono text-sm">{conn.port}</TableCell>
                  <TableCell className="font-mono text-sm">{conn.database}</TableCell>
                  <TableCell className="font-mono text-sm">{conn.username}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(conn.id)}
                      disabled={deleting === conn.id}
                    >
                      {deleting === conn.id ? "Deleting..." : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
