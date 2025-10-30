import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2, FileText, ExternalLink, AlertCircle, Pencil, X as XIcon, DollarSign, BarChart3 } from "lucide-react";
import { insertClientSchema, type InsertClient, type ClientWithRelations, type Carrier, type Plan, type PlanDocument } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TaskPanel } from "@/components/task-panel";
import { DrugAutocomplete } from "@/components/drug-autocomplete";
import { DoctorInput } from "@/components/doctor-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ClientDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [medications, setMedications] = useState<{ drugName: string; dosage?: string }[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | undefined>();
  const [isEditMode, setIsEditMode] = useState(false);
  const [readinessDialogOpen, setReadinessDialogOpen] = useState(false);

  // Helper function to format currency values
  const formatCurrency = (value: string | number | null | undefined): string => {
    if (value == null || value === "") return "N/A";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const { data: client, isLoading } = useQuery<ClientWithRelations>({
    queryKey: ["/api/clients", Number(id)],
    queryFn: () => fetch(`/api/clients/${id}`).then(res => res.json()),
    enabled: !!id,
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

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    values: client ? {
      fullName: client.fullName,
      birthdate: client.birthdate,
      phoneNumber: client.phoneNumber,
      medicareNumber: client.medicareNumber,
      partAStartDate: client.partAStartDate || "",
      partBStartDate: client.partBStartDate || "",
      carrierId: client.carrierId || undefined,
      planId: client.planId || undefined,
      socialSecurityNumber: client.socialSecurityNumber,
      address: client.address,
      city: client.city,
      state: client.state || "",
      zipCode: client.zipCode || "",
      county: client.county || "",
      status: client.status,
      clientStatus: client.clientStatus as "current_client" | "prospect" | undefined,
      hasMedicaid: client.hasMedicaid || false,
      hasChronicCondition: client.hasChronicCondition || false,
      goals: client.goals || "",
      usesMulticare: client.usesMulticare || false,
      spokeWithThisAep: client.spokeWithThisAep || false,
      continueWithCurrentPlan: client.continueWithCurrentPlan || false,
      currentCarrierId: client.currentCarrierId || undefined,
      currentPlanId: client.currentPlanId || undefined,
    } : undefined,
  });

  // Use current form value for currentPlanId to show dynamic updates
  const currentPlanId = form.watch("currentPlanId");

  // Fetch plan documents if a plan is selected (using form value for reactivity)
  const { data: planDocuments = [] } = useQuery<PlanDocument[]>({
    queryKey: ["/api/plans", currentPlanId, "documents"],
    queryFn: () => fetch(`/api/plans/${currentPlanId}/documents`).then(res => res.json()),
    enabled: !!currentPlanId,
  });

  // Fetch missing documents if a plan is selected (using form value for reactivity)
  const { data: missingDocuments = [] } = useQuery<string[]>({
    queryKey: ["/api/plans", currentPlanId, "missing-documents"],
    queryFn: () => fetch(`/api/plans/${currentPlanId}/missing-documents`).then(res => res.json()),
    enabled: !!currentPlanId,
  });

  // Fetch readiness check for comparison
  const { data: readinessData, refetch: refetchReadiness } = useQuery<{
    ready: boolean;
    missing: string[];
    warnings: string[];
    clientData: {
      hasCounty: boolean;
      hasCurrentPlan: boolean;
      medicationCount: number;
      doctorCount: number;
    };
  }>({
    queryKey: ["/api/clients", id, "readiness"],
    queryFn: () => fetch(`/api/clients/${id}/readiness`).then(res => res.json()),
    enabled: false, // Only fetch when button is clicked
  });

  // Update selectedCarrierId when client data loads
  useEffect(() => {
    if (client?.carrierId) {
      setSelectedCarrierId(client.carrierId);
    }
  }, [client]);

  // Set medications when client data loads
  useEffect(() => {
    if (client?.medications) {
      setMedications(client.medications.map(m => ({
        drugName: m.drugName,
        dosage: m.dosage || undefined
      })));
    }
  }, [client]);

  // Set doctors when client data loads
  useEffect(() => {
    if (client?.doctors) {
      setDoctors(client.doctors.map(d => d.name));
    }
  }, [client]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: InsertClient & { medications: typeof medications; doctors: typeof doctors }) => {
      return await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client record updated successfully.",
      });
      setIsEditMode(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client record.",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/clients/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Deleted",
        description: "Client record has been deleted.",
      });
      setLocation("/records");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client record.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    updateClientMutation.mutate({ ...data, medications, doctors });
  };

  const handleCancel = () => {
    if (client) {
      form.reset({
        fullName: client.fullName,
        birthdate: client.birthdate,
        phoneNumber: client.phoneNumber,
        medicareNumber: client.medicareNumber,
        partAStartDate: client.partAStartDate || "",
        partBStartDate: client.partBStartDate || "",
        carrierId: client.carrierId || undefined,
        planId: client.planId || undefined,
        socialSecurityNumber: client.socialSecurityNumber,
        address: client.address,
        city: client.city,
        state: client.state || "",
        zipCode: client.zipCode || "",
        county: client.county || "",
        status: client.status,
        clientStatus: client.clientStatus as "current_client" | "prospect" | undefined,
        hasMedicaid: client.hasMedicaid || false,
        hasChronicCondition: client.hasChronicCondition || false,
        goals: client.goals || "",
        usesMulticare: client.usesMulticare || false,
        spokeWithThisAep: client.spokeWithThisAep || false,
        continueWithCurrentPlan: client.continueWithCurrentPlan || false,
        currentCarrierId: client.currentCarrierId || undefined,
        currentPlanId: client.currentPlanId || undefined,
      });
      setMedications(client.medications.map(m => ({
        drugName: m.drugName,
        dosage: m.dosage || undefined
      })));
      setDoctors(client.doctors.map(d => d.name));
      setSelectedCarrierId(client.carrierId || undefined);
    }
    setIsEditMode(false);
  };

  const handleCompareClick = async () => {
    const result = await refetchReadiness();
    if (result.data?.ready) {
      // Ready to compare - navigate to comparison page
      await generateComparison();
    } else {
      // Show readiness dialog with missing data
      setReadinessDialogOpen(true);
    }
  };

  const compareClientMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clients/${id}/compare`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Comparison Generated",
        description: "Plan comparison has been created successfully.",
      });
      // Navigate to comparison page
      setLocation(`/clients/${id}/comparison/${data.comparisonId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate comparison.",
        variant: "destructive",
      });
    },
  });

  const generateComparison = async () => {
    compareClientMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Client not found</h2>
          <Button className="mt-4" onClick={() => setLocation("/records")}>
            Back to Records
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/records")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{client.fullName}</h1>
                {isEditMode && (
                  <Badge variant="secondary" className="text-xs">
                    Edit Mode
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Medicare: {client.medicareNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCompareClick}
                  disabled={compareClientMutation.isPending}
                  data-testid="button-compare-plans"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {compareClientMutation.isPending ? "Generating..." : "Compare Plans"}
                </Button>
                <Button
                  variant="default"
                  onClick={() => setIsEditMode(true)}
                  data-testid="button-edit-client"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-client">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Record
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this client record and all associated data.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteClientMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Client Form */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-name" disabled={!isEditMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="birthdate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-edit-birthdate" disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-phone" disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="county"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>County</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-county" disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Medicare & Identity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Medicare & Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="medicareNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medicare Number</FormLabel>
                          <FormControl>
                            <Input className="font-mono" {...field} data-testid="input-edit-medicare" disabled={!isEditMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="partAStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Part A Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="partBStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Part B Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="socialSecurityNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Social Security Number</FormLabel>
                          <FormControl>
                            <Input type="password" className="font-mono" {...field} disabled={!isEditMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!isEditMode} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input maxLength={2} {...field} disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!isEditMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Current Plan */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="currentCarrierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Carrier</FormLabel>
                            <Select
                              value={field.value?.toString() || ""}
                              onValueChange={(value) => {
                                const carrierId = value ? parseInt(value) : undefined;
                                field.onChange(carrierId);
                                setSelectedCarrierId(carrierId);
                                form.setValue("currentPlanId", undefined);
                              }}
                              disabled={!isEditMode}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-carrier">
                                  <SelectValue placeholder="Select a carrier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {carriers.map((carrier) => (
                                  <SelectItem key={carrier.id} value={carrier.id.toString()}>
                                    {carrier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="currentPlanId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan</FormLabel>
                            <Select
                              value={field.value?.toString() || ""}
                              onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                              disabled={!selectedCarrierId || !isEditMode}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-plan">
                                  <SelectValue placeholder="Select a plan" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id.toString()}>
                                    {plan.name} ({plan.planYear})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Status & Medications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status & Medications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!isEditMode}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DrugAutocomplete
                      medications={medications}
                      onAddMedication={(med) => setMedications([...medications, med])}
                      onRemoveMedication={(index) =>
                        setMedications(medications.filter((_, i) => i !== index))
                      }
                      disabled={!isEditMode}
                    />

                    <DoctorInput
                      doctors={doctors}
                      onAddDoctor={(name) => setDoctors([...doctors, name])}
                      onRemoveDoctor={(index) => setDoctors(doctors.filter((_, i) => i !== index))}
                      disabled={!isEditMode}
                    />

                    {/* Medical & Assistance Information */}
                    <div className="space-y-4 pt-4 border-t">
                      <FormField
                        control={form.control}
                        name="hasMedicaid"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isEditMode}
                                data-testid="checkbox-has-medicaid"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="cursor-pointer">
                                Assistance like Medicaid
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hasChronicCondition"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!isEditMode}
                                data-testid="checkbox-has-chronic-condition"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="cursor-pointer">
                                Has a Chronic Condition
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {isEditMode && (
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={updateClientMutation.isPending}
                      className="w-full md:w-auto"
                      data-testid="button-save-client"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateClientMutation.isPending}
                      className="w-full md:w-auto"
                      data-testid="button-cancel-edit"
                    >
                      <XIcon className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </div>

          {/* Right Column - Tasks & Plan Documents */}
          <div className="lg:col-span-1 space-y-6">
            {/* Current Plan Summary Card */}
            <Card data-testid="card-plan-summary">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Plan Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const plan = client.currentPlan || client.plan;
                  const carrier = client.currentCarrier || client.carrier;

                  if (!plan) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        No plan selected
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Plan Name & Type */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan Name</p>
                        <p className="text-sm font-medium mt-1" data-testid="text-plan-name">
                          {plan.name || "N/A"}
                        </p>
                      </div>

                      {/* Plan Year, Carrier & Type Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan Year</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-year">
                            {plan.planYear || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Carrier</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-carrier">
                            {carrier?.name || "N/A"}
                          </p>
                        </div>
                      </div>

                      {plan.planType && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan Type</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-type">
                            {plan.planType}
                          </p>
                        </div>
                      )}

                      {/* Monthly Premium */}
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Premium</p>
                        <p className="text-base font-semibold mt-1" data-testid="text-plan-premium">
                          {formatCurrency(plan.monthlyPremium)}
                        </p>
                      </div>

                      {/* Deductibles Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Annual Deductible</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-deductible">
                            {formatCurrency(plan.annualDeductible)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">RX Deductible</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-rx-deductible">
                            {formatCurrency(plan.prescriptionDeductible)}
                          </p>
                        </div>
                      </div>

                      {/* Max Out of Pocket */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Max OOP (In-Network)</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-max-oop">
                            {formatCurrency(plan.maxOutOfPocket)}
                          </p>
                        </div>
                        {plan.maxOutOfPocketOutNetwork && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Max OOP (Out-Network)</p>
                            <p className="text-sm font-medium mt-1" data-testid="text-plan-max-oop-out">
                              {formatCurrency(plan.maxOutOfPocketOutNetwork)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Copays Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Primary Care Copay</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-primary-copay">
                            {formatCurrency(plan.primaryCareCopay)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Specialist Copay</p>
                          <p className="text-sm font-medium mt-1" data-testid="text-plan-specialist-copay">
                            {formatCurrency(plan.specialistCopay)}
                          </p>
                        </div>
                      </div>

                      {/* Additional Benefits */}
                      {(plan.partBGiveback || plan.dentalAllowance || plan.otcCredit || plan.fitnessOption) && (
                        <div className="pt-2 border-t space-y-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Additional Benefits</p>
                          
                          {plan.partBGiveback && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Part B Giveback</p>
                              <p className="text-sm font-medium" data-testid="text-plan-part-b-giveback">
                                {formatCurrency(plan.partBGiveback)}
                              </p>
                            </div>
                          )}

                          {plan.dentalAllowance && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Dental Allowance</p>
                              <p className="text-sm font-medium" data-testid="text-plan-dental">
                                {formatCurrency(plan.dentalAllowance)}
                              </p>
                            </div>
                          )}

                          {plan.otcCredit && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">OTC Credit</p>
                              <p className="text-sm font-medium" data-testid="text-plan-otc">
                                {formatCurrency(plan.otcCredit)}
                              </p>
                            </div>
                          )}

                          {plan.benefitCard && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Benefit Card</p>
                              <p className="text-sm font-medium" data-testid="text-plan-benefit-card">
                                {plan.benefitCard}
                              </p>
                            </div>
                          )}

                          {plan.fitnessOption && (
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Fitness Program</p>
                              <p className="text-sm font-medium" data-testid="text-plan-fitness">
                                {plan.fitnessOption}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <TaskPanel clientId={client.id} tasks={client.tasks} />

            {/* Plan Documents */}
            {currentPlanId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Plan Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {missingDocuments.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/20">
                      <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">Missing Documents</p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          {missingDocuments.map((doc) => (
                            <li key={doc} data-testid={`text-missing-doc-${doc.toLowerCase().replace(/\s+/g, '-')}`}>• {doc}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {planDocuments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Available documents:</p>
                      {planDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm" data-testid={`text-doc-${doc.documentType.toLowerCase().replace(/\s+/g, '-')}`}>
                              {doc.documentType}
                            </span>
                          </div>
                          <a
                            href={doc.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            data-testid={`link-doc-${doc.documentType.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !missingDocuments.length && (
                      <p className="text-sm text-muted-foreground">
                        No documents uploaded for this plan yet.
                      </p>
                    )
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setLocation("/plans")}
                    data-testid="button-manage-plan-docs"
                  >
                    Manage Plan Documents
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Readiness Check Dialog */}
        <Dialog open={readinessDialogOpen} onOpenChange={setReadinessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {readinessData?.ready ? "Ready to Compare" : "Missing Information"}
              </DialogTitle>
              <DialogDescription>
                {readinessData?.ready
                  ? "All required information is available for plan comparison."
                  : "The following information is needed before generating a comparison:"
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {readinessData?.missing && readinessData.missing.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-destructive mb-2">Required:</h4>
                  <ul className="space-y-1">
                    {readinessData.missing.map((item, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {readinessData?.warnings && readinessData.warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-warning mb-2">Recommendations:</h4>
                  <ul className="space-y-1">
                    {readinessData.warnings.map((item, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setReadinessDialogOpen(false)}
                  data-testid="button-close-readiness"
                >
                  Close
                </Button>
                {readinessData?.ready && (
                  <Button
                    onClick={() => {
                      setReadinessDialogOpen(false);
                      generateComparison();
                    }}
                    disabled={compareClientMutation.isPending}
                    data-testid="button-generate-comparison"
                  >
                    {compareClientMutation.isPending ? "Generating..." : "Generate Comparison"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
