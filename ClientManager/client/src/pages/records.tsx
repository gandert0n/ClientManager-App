import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Search, PlusCircle, Upload, Filter, CheckCircle2, XCircle, Pill, UserPlus, Trash2, Edit } from "lucide-react";
import type { Client, Carrier, Plan } from "@shared/schema";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Records() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aepFilter, setAepFilter] = useState<string>("all");
  const [completionFilter, setCompletionFilter] = useState<string>("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [planChangeDialogOpen, setPlanChangeDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | undefined>();
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: completionData } = useQuery<Array<{ clientId: number; completion: any }>>({
    queryKey: ["/api/clients-completion"],
    queryFn: () => fetch("/api/clients-completion").then(res => res.json()),
  });

  const getClientCompletion = (clientId: number) => {
    return completionData?.find(c => c.clientId === clientId)?.completion || null;
  };

  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/clients/import-csv', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients-completion"] });
      toast({
        title: "Import Successful",
        description: `${data.imported} clients imported successfully. ${data.errors} errors.`,
      });
      setImportDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "There was an error importing the CSV file.",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: number) => {
      return apiRequest("DELETE", `/api/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients-completion"] });
      setClientToDelete(null);
      toast({
        title: "Client deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete client",
        variant: "destructive",
      });
      setClientToDelete(null);
    },
  });

  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
    queryFn: () => fetch("/api/carriers").then(res => res.json()),
  });

  // Fetch plans for selected carrier
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans", selectedCarrierId],
    queryFn: () => 
      fetch(selectedCarrierId ? `/api/plans?carrierId=${selectedCarrierId}` : "/api/plans")
        .then(res => res.json()),
  });

  // Update client plan mutation
  const updateClientPlanMutation = useMutation({
    mutationFn: async ({ clientId, currentCarrierId, currentPlanId }: { clientId: number; currentCarrierId?: number; currentPlanId?: number }) => {
      return apiRequest("PATCH", `/api/clients/${clientId}`, {
        currentCarrierId: currentCarrierId || null,
        currentPlanId: currentPlanId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setPlanChangeDialogOpen(false);
      setClientToEdit(null);
      setSelectedCarrierId(undefined);
      setSelectedPlanId(undefined);
      toast({
        title: "Plan updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const handleOpenPlanChange = (client: Client) => {
    setClientToEdit(client);
    setSelectedCarrierId(client.currentCarrierId || undefined);
    setSelectedPlanId(client.currentPlanId || undefined);
    setPlanChangeDialogOpen(true);
  };

  const handleSavePlanChange = () => {
    if (clientToEdit) {
      updateClientPlanMutation.mutate({
        clientId: clientToEdit.id,
        currentCarrierId: selectedCarrierId,
        currentPlanId: selectedPlanId,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      csvImportMutation.mutate(file);
    }
  };

  const filteredClients = clients?.filter((client) => {
    const matchesSearch =
      client.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.medicareNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phoneNumber.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || client.status === statusFilter;

    const matchesAep = 
      aepFilter === "all" ||
      (aepFilter === "needs_contact" && !client.spokeWithThisAep) ||
      (aepFilter === "spoke" && client.spokeWithThisAep && !client.continueWithCurrentPlan) ||
      (aepFilter === "continuing" && client.continueWithCurrentPlan);

    const matchesCompletion = (() => {
      if (completionFilter === "all") return true;
      const completion = getClientCompletion(client.id);
      if (!completion) return completionFilter === "all";
      const percentage = completion.overallPercentage || 0;
      
      if (completionFilter === "incomplete") return percentage < 100;
      if (completionFilter === "partial") return percentage >= 25 && percentage <= 75;
      if (completionFilter === "complete") return percentage === 100;
      return true;
    })();

    return matchesSearch && matchesStatus && matchesAep && matchesCompletion;
  }) || [];

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
          <p className="mt-4 text-sm text-muted-foreground">Loading records...</p>
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
            <h1 className="text-2xl font-semibold">All Records</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-csv">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Clients from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with client information. The system will automatically map columns.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Click to select CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported columns: name, dob, phone, medicare_number, ssn, address, etc.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4"
                      disabled={csvImportMutation.isPending}
                      data-testid="button-select-csv"
                    >
                      {csvImportMutation.isPending ? "Importing..." : "Select File"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Link href="/new-intake">
              <Button data-testid="button-new-record">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Record
              </Button>
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, Medicare number, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={aepFilter} onValueChange={setAepFilter}>
                  <SelectTrigger className="w-full md:w-60" data-testid="select-aep-filter">
                    <SelectValue placeholder="AEP Contact Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All AEP Statuses</SelectItem>
                    <SelectItem value="needs_contact">Needs Contact</SelectItem>
                    <SelectItem value="spoke">Spoke - Needs Decision</SelectItem>
                    <SelectItem value="continuing">Continuing with Plan</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={completionFilter} onValueChange={setCompletionFilter}>
                  <SelectTrigger className="w-full md:w-60" data-testid="select-completion-filter">
                    <SelectValue placeholder="Completion Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Completion Levels</SelectItem>
                    <SelectItem value="incomplete">Incomplete (&lt;100%)</SelectItem>
                    <SelectItem value="partial">Partial (25-75%)</SelectItem>
                    <SelectItem value="complete">Complete (100%)</SelectItem>
                  </SelectContent>
                </Select>
                {(statusFilter !== "all" || aepFilter !== "all" || completionFilter !== "all" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("all");
                      setAepFilter("all");
                      setCompletionFilter("all");
                      setSearchQuery("");
                    }}
                    data-testid="button-clear-filters"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Client Records</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium">No records found</h3>
                <p className="mt-2 text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by creating your first client intake."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        DOB
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Medicare #
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Current Plan
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Completion
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Last Updated
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b hover-elevate"
                        data-testid={`client-record-${client.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{client.fullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {client.phoneNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {format(new Date(client.birthdate), "MM/dd/yyyy")}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {client.medicareNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">
                              {client.currentPlanId ? (
                                <>
                                  <div className="font-medium">{carriers.find(c => c.id === client.currentCarrierId)?.name || "-"}</div>
                                  <div className="text-muted-foreground">Plan ID: {client.currentPlanId}</div>
                                </>
                              ) : (
                                <span className="text-muted-foreground">No plan assigned</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPlanChange(client)}
                              data-testid={`button-edit-plan-${client.id}`}
                              className="h-7 w-7"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={getStatusColor(client.status)}>
                            {client.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const completion = getClientCompletion(client.id);
                            if (!completion) return <span className="text-sm text-muted-foreground">-</span>;
                            const percentage = completion.overallPercentage || 0;
                            return (
                              <div className="flex items-center gap-2">
                                <Progress value={percentage} className="w-20" />
                                <span className="text-sm font-medium">{percentage}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {format(new Date(client.updatedAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/clients/${client.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-${client.id}`}
                              >
                                View
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setClientToDelete(client)}
                              data-testid={`button-delete-${client.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Client Confirmation Dialog */}
        <AlertDialog open={clientToDelete !== null} onOpenChange={() => setClientToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Client</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{clientToDelete?.fullName}"? This will permanently delete the client and all associated data including medications, doctors, and tasks. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-client">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (clientToDelete) {
                    deleteClientMutation.mutate(clientToDelete.id);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-client"
              >
                {deleteClientMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Plan Change Dialog */}
        <Dialog open={planChangeDialogOpen} onOpenChange={(open) => {
          setPlanChangeDialogOpen(open);
          if (!open) {
            setClientToEdit(null);
            setSelectedCarrierId(undefined);
            setSelectedPlanId(undefined);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Plan</DialogTitle>
              <DialogDescription>
                Update the current plan for {clientToEdit?.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="plan-carrier" className="text-sm font-medium">Carrier</label>
                <Select
                  value={selectedCarrierId?.toString() || ""}
                  onValueChange={(value) => {
                    const carrierId = value ? parseInt(value) : undefined;
                    setSelectedCarrierId(carrierId);
                    setSelectedPlanId(undefined);
                  }}
                >
                  <SelectTrigger id="plan-carrier" data-testid="select-carrier-change">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No carrier</SelectItem>
                    {carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id.toString()}>
                        {carrier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="plan-select" className="text-sm font-medium">Plan</label>
                <Select
                  value={selectedPlanId?.toString() || ""}
                  onValueChange={(value) => setSelectedPlanId(value ? parseInt(value) : undefined)}
                  disabled={!selectedCarrierId}
                >
                  <SelectTrigger id="plan-select" data-testid="select-plan-change">
                    <SelectValue placeholder={selectedCarrierId ? "Select plan" : "Select carrier first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No plan</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name} ({plan.planYear})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPlanChangeDialogOpen(false);
                  setClientToEdit(null);
                  setSelectedCarrierId(undefined);
                  setSelectedPlanId(undefined);
                }}
                data-testid="button-cancel-plan-change"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePlanChange}
                disabled={updateClientPlanMutation.isPending}
                data-testid="button-save-plan-change"
              >
                {updateClientPlanMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
