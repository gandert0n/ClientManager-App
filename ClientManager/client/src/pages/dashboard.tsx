import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, CheckCircle2, PlusCircle } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@shared/schema";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const totalRecords = clients?.length || 0;
  const pendingRecords = clients?.filter(p => p.status === "pending").length || 0;
  const completedThisMonth = clients?.filter(p => {
    const createdDate = new Date(p.createdAt);
    const now = new Date();
    return p.status === "completed" && 
           createdDate.getMonth() === now.getMonth() &&
           createdDate.getFullYear() === now.getFullYear();
  }).length || 0;

  const recentClients = clients?.slice(0, 5) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Welcome Back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <Link href="/new-intake">
            <Button data-testid="button-new-intake">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Intake
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Records
              </CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="stat-total-records">
                {totalRecords}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All patient records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Applications
              </CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="stat-pending">
                {pendingRecords}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed This Month
              </CardTitle>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold" data-testid="stat-completed">
                {completedThisMonth}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully processed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Entries</CardTitle>
              <Link href="/records">
                <Button variant="ghost" size="sm" data-testid="button-view-all">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium">No clients yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Get started by creating your first client intake.
                </p>
                <Link href="/new-intake">
                  <Button className="mt-4" data-testid="button-create-first">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create First Intake
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentClients.map((client) => (
                  <Link key={client.id} href={`/clients/${client.id}`}>
                    <div
                      className="flex items-center justify-between p-4 rounded-md border hover-elevate active-elevate-2 cursor-pointer"
                      data-testid={`client-row-${client.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{client.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              Medicare: {client.medicareNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getStatusColor(client.status)}>
                          {client.status.replace("_", " ").toUpperCase()}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(client.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
