import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, MapPin, FileText, PlusCircle, Upload, AlertTriangle, CheckCircle2, Trash2, DollarSign, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Carrier, Plan, State, PlanDocument, PlanWithCarrierAndState } from "@shared/schema";

export default function MasterManagement() {
  const { toast } = useToast();

  // State management
  const [newCarrierName, setNewCarrierName] = useState("");
  const [newStateName, setNewStateName] = useState("");
  const [newStateCode, setNewStateCode] = useState("");
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<Plan | null>(null);
  const [isCarrierDialogOpen, setIsCarrierDialogOpen] = useState(false);
  const [isStateDialogOpen, setIsStateDialogOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedPlanForUpload, setSelectedPlanForUpload] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");

  // Form state for creating/editing plans
  const [planForm, setPlanForm] = useState({
    name: "",
    planNumber: "",
    carrierId: "",
    planYear: new Date().getFullYear().toString(),
    stateCode: "",
    planType: "",
    monthlyPremium: "",
    annualDeductible: "",
    maxOutOfPocket: "",
    maxOutOfPocketOutNetwork: "",
    partBGiveback: "",
    specialistCopay: "",
    primaryCareCopay: "",
    dentalAllowance: "",
    benefitCard: "",
    benefitCardFrequency: "",
    otcCredit: "",
    otcCreditFrequency: "",
    fitnessOption: "",
    inpatientHospitalCare: "",
    prescriptionDeductible: "",
    prescriptionDeductibleTiers: "",
    tier1Drugs: "",
    tier1DrugsType: "$",
    tier2Drugs: "",
    tier2DrugsType: "$",
    tier3Drugs: "",
    tier3DrugsType: "%",
    tier4Drugs: "",
    tier4DrugsType: "%",
    tier5Drugs: "",
    tier5DrugsType: "%",
    medicaidLevels: "",
    providerNetwork: "",
    counties: "",
    isNoncommissionable: false,
    hasReducedCommissionIfTransferred: false,
  });

  // Fetch carriers
  const { data: carriers = [], isLoading: loadingCarriers } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
    queryFn: () => fetch("/api/carriers").then(res => res.json()),
  });

  // Fetch states
  const { data: states = [], isLoading: loadingStates } = useQuery<State[]>({
    queryKey: ["/api/states"],
    queryFn: () => fetch("/api/states").then(res => res.json()),
  });

  // Fetch all plans with carrier and state info
  const { data: plans = [], isLoading: loadingPlans } = useQuery<PlanWithCarrierAndState[]>({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await fetch("/api/plans");
      return response.json();
    },
  });

  // Fetch selected plan documents
  const { data: selectedPlanDocs = [] } = useQuery<PlanDocument[]>({
    queryKey: ["/api/plans", selectedPlanForUpload, "documents"],
    queryFn: () => fetch(`/api/plans/${selectedPlanForUpload}/documents`).then(res => res.json()),
    enabled: selectedPlanForUpload !== null,
  });

  // Fetch missing documents
  const { data: missingDocs = [] } = useQuery<string[]>({
    queryKey: ["/api/plans", selectedPlanForUpload, "missing-documents"],
    queryFn: () => fetch(`/api/plans/${selectedPlanForUpload}/missing-documents`).then(res => res.json()),
    enabled: selectedPlanForUpload !== null,
  });

  // Create carrier mutation
  const createCarrier = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/carriers", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      setNewCarrierName("");
      setIsCarrierDialogOpen(false);
      toast({ title: "Carrier created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create carrier", variant: "destructive" });
    },
  });

  // Delete carrier mutation
  const deleteCarrier = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/carriers/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      toast({ title: "Carrier deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete carrier", variant: "destructive" });
    },
  });

  // Create state mutation
  const createState = useMutation({
    mutationFn: async (data: { code: string; name: string }) => {
      return apiRequest("POST", "/api/states", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/states"] });
      setNewStateName("");
      setNewStateCode("");
      setIsStateDialogOpen(false);
      toast({ title: "State added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add state", variant: "destructive" });
    },
  });

  // Delete state mutation
  const deleteState = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest("DELETE", `/api/states/${code}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/states"] });
      toast({ title: "State deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete state", variant: "destructive" });
    },
  });

  // Create/Update plan mutation
  const savePlan = useMutation({
    mutationFn: async (data: any) => {
      const planData = {
        name: data.name,
        planNumber: data.planNumber || null,
        carrierId: parseInt(data.carrierId),
        planYear: parseInt(data.planYear),
        stateCode: data.stateCode || null,
        planType: data.planType || null,
        monthlyPremium: data.monthlyPremium ? String(data.monthlyPremium) : null,
        annualDeductible: data.annualDeductible ? String(data.annualDeductible) : null,
        maxOutOfPocket: data.maxOutOfPocket ? String(data.maxOutOfPocket) : null,
        maxOutOfPocketOutNetwork: data.maxOutOfPocketOutNetwork ? String(data.maxOutOfPocketOutNetwork) : null,
        partBGiveback: data.partBGiveback ? String(data.partBGiveback) : null,
        specialistCopay: data.specialistCopay ? String(data.specialistCopay) : null,
        primaryCareCopay: data.primaryCareCopay ? String(data.primaryCareCopay) : null,
        dentalAllowance: data.dentalAllowance ? String(data.dentalAllowance) : null,
        benefitCard: data.benefitCard ? String(data.benefitCard) : null,
        benefitCardFrequency: data.benefitCardFrequency || null,
        otcCredit: data.otcCredit ? String(data.otcCredit) : null,
        otcCreditFrequency: data.otcCreditFrequency || null,
        fitnessOption: data.fitnessOption || null,
        inpatientHospitalCare: data.inpatientHospitalCare || null,
        prescriptionDeductible: data.prescriptionDeductible ? String(data.prescriptionDeductible) : null,
        prescriptionDeductibleTiers: data.prescriptionDeductibleTiers || null,
        tier1Drugs: data.tier1Drugs || null,
        tier1DrugsType: data.tier1DrugsType || null,
        tier2Drugs: data.tier2Drugs || null,
        tier2DrugsType: data.tier2DrugsType || null,
        tier3Drugs: data.tier3Drugs || null,
        tier3DrugsType: data.tier3DrugsType || null,
        tier4Drugs: data.tier4Drugs || null,
        tier4DrugsType: data.tier4DrugsType || null,
        tier5Drugs: data.tier5Drugs || null,
        tier5DrugsType: data.tier5DrugsType || null,
        medicaidLevels: data.medicaidLevels || null,
        providerNetwork: data.providerNetwork || null,
        counties: data.counties ? data.counties.split(',').map((c: string) => c.trim()).filter(Boolean) : [],
        isNoncommissionable: data.isNoncommissionable || false,
        hasReducedCommissionIfTransferred: data.hasReducedCommissionIfTransferred || false,
      };

      if (selectedPlanForEdit) {
        return apiRequest("PATCH", `/api/plans/${selectedPlanForEdit.id}`, planData);
      } else {
        return apiRequest("POST", "/api/plans", planData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      resetPlanForm();
      setIsPlanDialogOpen(false);
      toast({ title: selectedPlanForEdit ? "Plan updated successfully" : "Plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save plan", variant: "destructive" });
    },
  });

  // Delete plan mutation
  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/plans/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ title: "Plan deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    },
  });

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: async ({ planId, file, docType }: { planId: number; file: File; docType: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);

      const response = await fetch(`/api/plans/${planId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanForUpload, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanForUpload, "missing-documents"] });
      setUploadFile(null);
      setUploadDocType("");
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to upload document", variant: "destructive" });
    },
  });

  const resetPlanForm = () => {
    setPlanForm({
      name: "",
      planNumber: "",
      carrierId: "",
      planYear: new Date().getFullYear().toString(),
      stateCode: "",
      planType: "",
      monthlyPremium: "",
      annualDeductible: "",
      maxOutOfPocket: "",
      maxOutOfPocketOutNetwork: "",
      partBGiveback: "",
      specialistCopay: "",
      primaryCareCopay: "",
      dentalAllowance: "",
      benefitCard: "",
      benefitCardFrequency: "",
      otcCredit: "",
      otcCreditFrequency: "",
      fitnessOption: "",
      inpatientHospitalCare: "",
      prescriptionDeductible: "",
      prescriptionDeductibleTiers: "",
      tier1Drugs: "",
      tier1DrugsType: "$",
      tier2Drugs: "",
      tier2DrugsType: "$",
      tier3Drugs: "",
      tier3DrugsType: "%",
      tier4Drugs: "",
      tier4DrugsType: "%",
      tier5Drugs: "",
      tier5DrugsType: "%",
      medicaidLevels: "",
      providerNetwork: "",
      counties: "",
      isNoncommissionable: false,
      hasReducedCommissionIfTransferred: false,
    });
    setSelectedPlanForEdit(null);
  };

  const handleEditPlan = (plan: Plan) => {
    setSelectedPlanForEdit(plan);
    setPlanForm({
      name: plan.name,
      planNumber: plan.planNumber || "",
      carrierId: plan.carrierId.toString(),
      planYear: plan.planYear.toString(),
      stateCode: plan.stateCode || "",
      planType: plan.planType || "",
      monthlyPremium: plan.monthlyPremium || "",
      annualDeductible: plan.annualDeductible || "",
      maxOutOfPocket: plan.maxOutOfPocket || "",
      maxOutOfPocketOutNetwork: plan.maxOutOfPocketOutNetwork || "",
      partBGiveback: plan.partBGiveback || "",
      specialistCopay: plan.specialistCopay || "",
      primaryCareCopay: plan.primaryCareCopay || "",
      dentalAllowance: plan.dentalAllowance || "",
      benefitCard: plan.benefitCard || "",
      benefitCardFrequency: plan.benefitCardFrequency || "",
      otcCredit: plan.otcCredit || "",
      otcCreditFrequency: plan.otcCreditFrequency || "",
      fitnessOption: plan.fitnessOption || "",
      inpatientHospitalCare: plan.inpatientHospitalCare || "",
      prescriptionDeductible: plan.prescriptionDeductible || "",
      prescriptionDeductibleTiers: plan.prescriptionDeductibleTiers || "",
      tier1Drugs: plan.tier1Drugs || "",
      tier1DrugsType: plan.tier1DrugsType || "$",
      tier2Drugs: plan.tier2Drugs || "",
      tier2DrugsType: plan.tier2DrugsType || "$",
      tier3Drugs: plan.tier3Drugs || "",
      tier3DrugsType: plan.tier3DrugsType || "%",
      tier4Drugs: plan.tier4Drugs || "",
      tier4DrugsType: plan.tier4DrugsType || "%",
      tier5Drugs: plan.tier5Drugs || "",
      tier5DrugsType: plan.tier5DrugsType || "%",
      medicaidLevels: plan.medicaidLevels || "",
      providerNetwork: plan.providerNetwork || "",
      counties: plan.counties?.join(", ") || "",
      isNoncommissionable: plan.isNoncommissionable || false,
      hasReducedCommissionIfTransferred: plan.hasReducedCommissionIfTransferred || false,
    });
    setIsPlanDialogOpen(true);
  };

  const handleOpenDocumentUpload = (planId: number) => {
    setSelectedPlanForUpload(planId);
    setIsUploadDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-master-title">Master Management</h1>
        <p className="text-muted-foreground">Manage carriers, states, and the plans you're appointed to sell</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList data-testid="tabs-master-management">
          <TabsTrigger value="carriers" data-testid="tab-carriers">Carriers</TabsTrigger>
          <TabsTrigger value="states" data-testid="tab-states">States</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
        </TabsList>

        {/* Carriers Tab */}
        <TabsContent value="carriers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Insurance Carriers</h2>
            <Dialog open={isCarrierDialogOpen} onOpenChange={setIsCarrierDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-carrier">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Carrier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Carrier</DialogTitle>
                  <DialogDescription>Create a new insurance carrier</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="carrier-name">Carrier Name</Label>
                    <Input
                      id="carrier-name"
                      data-testid="input-carrier-name"
                      value={newCarrierName}
                      onChange={(e) => setNewCarrierName(e.target.value)}
                      placeholder="e.g., Humana, Aetna, UnitedHealthcare"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    data-testid="button-save-carrier"
                    onClick={() => createCarrier.mutate(newCarrierName)}
                    disabled={!newCarrierName.trim() || createCarrier.isPending}
                  >
                    {createCarrier.isPending ? "Creating..." : "Create Carrier"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingCarriers ? (
                <p className="text-muted-foreground col-span-full">Loading carriers...</p>
              ) : carriers.length === 0 ? (
                <p className="text-muted-foreground col-span-full">No carriers found. Add your first carrier to get started.</p>
              ) : (
                carriers.map((carrier) => (
                  <Card key={carrier.id} className="hover-elevate">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg" data-testid={`text-carrier-${carrier.id}`}>{carrier.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-carrier-${carrier.id}`}
                        onClick={() => {
                          if (confirm(`Delete ${carrier.name}? This will also delete all associated plans.`)) {
                            deleteCarrier.mutate(carrier.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* States Tab */}
        <TabsContent value="states" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">States</h2>
            <Dialog open={isStateDialogOpen} onOpenChange={setIsStateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-state">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add State
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New State</DialogTitle>
                  <DialogDescription>Add a state where you sell plans</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="state-code">State Code (2 letters)</Label>
                    <Input
                      id="state-code"
                      data-testid="input-state-code"
                      value={newStateCode}
                      onChange={(e) => setNewStateCode(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="e.g., WA, CA, TX"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state-name">State Name</Label>
                    <Input
                      id="state-name"
                      data-testid="input-state-name"
                      value={newStateName}
                      onChange={(e) => setNewStateName(e.target.value)}
                      placeholder="e.g., Washington"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    data-testid="button-save-state"
                    onClick={() => createState.mutate({ code: newStateCode, name: newStateName })}
                    disabled={!newStateCode.trim() || !newStateName.trim() || createState.isPending}
                  >
                    {createState.isPending ? "Adding..." : "Add State"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingStates ? (
                <p className="text-muted-foreground col-span-full">Loading states...</p>
              ) : states.length === 0 ? (
                <p className="text-muted-foreground col-span-full">No states configured. Add the states where you sell plans.</p>
              ) : (
                states.map((state) => (
                  <Card key={state.code} className="hover-elevate">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-state-${state.code}`}>{state.code}</CardTitle>
                          <CardDescription>{state.name}</CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-state-${state.code}`}
                        onClick={() => {
                          if (confirm(`Delete ${state.name}?`)) {
                            deleteState.mutate(state.code);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Medicare Plans</h2>
            <Dialog open={isPlanDialogOpen} onOpenChange={(open) => {
              setIsPlanDialogOpen(open);
              if (!open) resetPlanForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-plan">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedPlanForEdit ? "Edit Plan" : "Add New Plan"}</DialogTitle>
                  <DialogDescription>Configure all plan details and benefits</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[70vh] pr-4">
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="plan-name">Plan Name *</Label>
                          <Input
                            id="plan-name"
                            data-testid="input-plan-name"
                            value={planForm.name}
                            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                            placeholder="e.g., Medicare Advantage Gold"
                          />
                        </div>
                        <div>
                          <Label htmlFor="plan-number">Plan Number</Label>
                          <Input
                            id="plan-number"
                            data-testid="input-plan-number"
                            value={planForm.planNumber}
                            onChange={(e) => setPlanForm({ ...planForm, planNumber: e.target.value })}
                            placeholder="e.g., H1234-001"
                          />
                        </div>
                        <div>
                          <Label htmlFor="plan-carrier">Carrier *</Label>
                          <Select
                            value={planForm.carrierId}
                            onValueChange={(value) => setPlanForm({ ...planForm, carrierId: value })}
                          >
                            <SelectTrigger id="plan-carrier" data-testid="select-plan-carrier">
                              <SelectValue placeholder="Select carrier" />
                            </SelectTrigger>
                            <SelectContent>
                              {carriers.map((carrier) => (
                                <SelectItem key={carrier.id} value={carrier.id.toString()}>
                                  {carrier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="plan-state">State</Label>
                          <Select
                            value={planForm.stateCode}
                            onValueChange={(value) => setPlanForm({ ...planForm, stateCode: value })}
                          >
                            <SelectTrigger id="plan-state" data-testid="select-plan-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.name} ({state.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="plan-year">Plan Year *</Label>
                          <Input
                            id="plan-year"
                            data-testid="input-plan-year"
                            type="number"
                            value={planForm.planYear}
                            onChange={(e) => setPlanForm({ ...planForm, planYear: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="plan-type">Plan Type</Label>
                          <Input
                            id="plan-type"
                            data-testid="input-plan-type"
                            value={planForm.planType}
                            onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
                            placeholder="e.g., HMO, PPO, HMO-POS"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Costs & Deductibles */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Costs & Deductibles
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="monthly-premium">Monthly Premium ($)</Label>
                          <Input
                            id="monthly-premium"
                            data-testid="input-monthly-premium"
                            type="number"
                            step="0.01"
                            value={planForm.monthlyPremium}
                            onChange={(e) => setPlanForm({ ...planForm, monthlyPremium: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="annual-deductible">Annual Deductible ($)</Label>
                          <Input
                            id="annual-deductible"
                            data-testid="input-annual-deductible"
                            type="number"
                            step="0.01"
                            value={planForm.annualDeductible}
                            onChange={(e) => setPlanForm({ ...planForm, annualDeductible: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-oop">Max Out-of-Pocket (In-Network) ($)</Label>
                          <Input
                            id="max-oop"
                            data-testid="input-max-oop"
                            type="number"
                            step="0.01"
                            value={planForm.maxOutOfPocket}
                            onChange={(e) => setPlanForm({ ...planForm, maxOutOfPocket: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-oop-out">Max Out-of-Pocket (Out-of-Network) ($)</Label>
                          <Input
                            id="max-oop-out"
                            data-testid="input-max-oop-out"
                            type="number"
                            step="0.01"
                            value={planForm.maxOutOfPocketOutNetwork}
                            onChange={(e) => setPlanForm({ ...planForm, maxOutOfPocketOutNetwork: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Copays */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm">Copays</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="primary-copay">Primary Care Copay ($)</Label>
                          <Input
                            id="primary-copay"
                            data-testid="input-primary-copay"
                            type="number"
                            step="0.01"
                            value={planForm.primaryCareCopay}
                            onChange={(e) => setPlanForm({ ...planForm, primaryCareCopay: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="specialist-copay">Specialist Copay ($)</Label>
                          <Input
                            id="specialist-copay"
                            data-testid="input-specialist-copay"
                            type="number"
                            step="0.01"
                            value={planForm.specialistCopay}
                            onChange={(e) => setPlanForm({ ...planForm, specialistCopay: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Benefits */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm">Additional Benefits</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="part-b-giveback">Part B Premium Reduction ($)</Label>
                          <Input
                            id="part-b-giveback"
                            data-testid="input-part-b-giveback"
                            type="number"
                            step="0.01"
                            value={planForm.partBGiveback}
                            onChange={(e) => setPlanForm({ ...planForm, partBGiveback: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="dental">Dental Allowance ($)</Label>
                          <Input
                            id="dental"
                            data-testid="input-dental"
                            type="number"
                            step="0.01"
                            value={planForm.dentalAllowance}
                            onChange={(e) => setPlanForm({ ...planForm, dentalAllowance: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="otc-credit">OTC Credit ($)</Label>
                          <Input
                            id="otc-credit"
                            data-testid="input-otc-credit"
                            type="number"
                            step="0.01"
                            value={planForm.otcCredit}
                            onChange={(e) => setPlanForm({ ...planForm, otcCredit: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="otc-frequency">OTC Credit Frequency</Label>
                          <Select
                            value={planForm.otcCreditFrequency}
                            onValueChange={(value) => setPlanForm({ ...planForm, otcCreditFrequency: value })}
                          >
                            <SelectTrigger id="otc-frequency" data-testid="select-otc-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="benefit-card">Benefit Card ($)</Label>
                          <Input
                            id="benefit-card"
                            data-testid="input-benefit-card"
                            type="number"
                            step="0.01"
                            value={planForm.benefitCard}
                            onChange={(e) => setPlanForm({ ...planForm, benefitCard: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="benefit-card-frequency">Benefit Card Frequency</Label>
                          <Select
                            value={planForm.benefitCardFrequency}
                            onValueChange={(value) => setPlanForm({ ...planForm, benefitCardFrequency: value })}
                          >
                            <SelectTrigger id="benefit-card-frequency" data-testid="select-benefit-card-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="fitness">Fitness Program</Label>
                          <Input
                            id="fitness"
                            data-testid="input-fitness"
                            value={planForm.fitnessOption}
                            onChange={(e) => setPlanForm({ ...planForm, fitnessOption: e.target.value })}
                            placeholder="e.g., SilverSneakers, Renew Active"
                          />
                        </div>
                        <div>
                          <Label htmlFor="inpatient">Inpatient Hospital Care</Label>
                          <Input
                            id="inpatient"
                            data-testid="input-inpatient"
                            value={planForm.inpatientHospitalCare}
                            onChange={(e) => setPlanForm({ ...planForm, inpatientHospitalCare: e.target.value })}
                            placeholder="e.g., $0 copay per day"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Prescription Drug Coverage */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm">Prescription Drug Coverage</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="prescription-deductible">Prescription Deductible ($)</Label>
                          <Input
                            id="prescription-deductible"
                            data-testid="input-prescription-deductible"
                            type="number"
                            step="0.01"
                            value={planForm.prescriptionDeductible}
                            onChange={(e) => setPlanForm({ ...planForm, prescriptionDeductible: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="deductible-tiers">Deductible Applies to Tiers</Label>
                          <Select
                            value={planForm.prescriptionDeductibleTiers}
                            onValueChange={(value) => setPlanForm({ ...planForm, prescriptionDeductibleTiers: value })}
                          >
                            <SelectTrigger id="deductible-tiers" data-testid="select-deductible-tiers">
                              <SelectValue placeholder="Select tier range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-5">Tiers 1-5</SelectItem>
                              <SelectItem value="3-5">Tiers 3-5</SelectItem>
                              <SelectItem value="4-5">Tiers 4-5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Drug Tiers */}
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((tier) => (
                          <div key={tier} className="grid grid-cols-3 gap-4 items-end">
                            <div className="col-span-2">
                              <Label htmlFor={`tier${tier}`}>Tier {tier} Drugs</Label>
                              <Input
                                id={`tier${tier}`}
                                data-testid={`input-tier${tier}`}
                                value={planForm[`tier${tier}Drugs` as keyof typeof planForm] as string}
                                onChange={(e) => setPlanForm({ ...planForm, [`tier${tier}Drugs`]: e.target.value })}
                                placeholder={tier <= 2 ? "$0-$20" : "20%-50%"}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`tier${tier}-type`}>Type</Label>
                              <Select
                                value={planForm[`tier${tier}DrugsType` as keyof typeof planForm] as string}
                                onValueChange={(value) => setPlanForm({ ...planForm, [`tier${tier}DrugsType`]: value })}
                              >
                                <SelectTrigger id={`tier${tier}-type`} data-testid={`select-tier${tier}-type`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="$">$ (Dollar)</SelectItem>
                                  <SelectItem value="%">% (Percent)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Network & SNP Information */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm">Network & SNP Information</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="provider-network">Provider Network</Label>
                          <Input
                            id="provider-network"
                            data-testid="input-provider-network"
                            value={planForm.providerNetwork}
                            onChange={(e) => setPlanForm({ ...planForm, providerNetwork: e.target.value })}
                            placeholder="e.g., National PPO Network"
                          />
                        </div>
                        <div>
                          <Label htmlFor="medicaid-levels">Medicaid Levels (D-SNP)</Label>
                          <Input
                            id="medicaid-levels"
                            data-testid="input-medicaid-levels"
                            value={planForm.medicaidLevels}
                            onChange={(e) => setPlanForm({ ...planForm, medicaidLevels: e.target.value })}
                            placeholder="e.g., Full Dual, Partial Dual"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Market Service Area */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Market Service Area
                      </h3>
                      <div>
                        <Label htmlFor="plan-counties">Counties (comma-separated)</Label>
                        <Input
                          id="plan-counties"
                          data-testid="input-plan-counties"
                          value={planForm.counties}
                          onChange={(e) => setPlanForm({ ...planForm, counties: e.target.value })}
                          placeholder="e.g., King, Pierce, Snohomish, Kitsap"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          List the counties where this plan is available. The comparison engine will match plans based on the client's county.
                        </p>
                      </div>
                    </div>

                    {/* Commission Information */}
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm">Commission Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="noncommissionable"
                            data-testid="checkbox-noncommissionable"
                            checked={planForm.isNoncommissionable}
                            onCheckedChange={(checked) => setPlanForm({ ...planForm, isNoncommissionable: checked as boolean })}
                          />
                          <Label htmlFor="noncommissionable" className="text-sm font-normal cursor-pointer">
                            Non-commissionable plan
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="reduced-commission"
                            data-testid="checkbox-reduced-commission"
                            checked={planForm.hasReducedCommissionIfTransferred}
                            onCheckedChange={(checked) => setPlanForm({ ...planForm, hasReducedCommissionIfTransferred: checked as boolean })}
                          />
                          <Label htmlFor="reduced-commission" className="text-sm font-normal cursor-pointer">
                            Reduced commission if transferred to
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetPlanForm();
                      setIsPlanDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    data-testid="button-save-plan"
                    onClick={() => savePlan.mutate(planForm)}
                    disabled={!planForm.name.trim() || !planForm.carrierId || savePlan.isPending}
                  >
                    {savePlan.isPending ? "Saving..." : selectedPlanForEdit ? "Update Plan" : "Create Plan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingPlans ? (
                <p className="text-muted-foreground col-span-full">Loading plans...</p>
              ) : plans.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No plans configured. Add your first plan to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                plans.map((plan) => (
                  <Card key={plan.id} className="hover-elevate">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate" data-testid={`text-plan-${plan.id}`}>{plan.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{plan.planYear}</span>
                          {plan.state && (
                            <>
                              <span>•</span>
                              <span>{plan.state.code}</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-edit-plan-${plan.id}`}
                          onClick={() => handleEditPlan(plan)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-plan-${plan.id}`}
                          onClick={() => {
                            if (confirm(`Delete ${plan.name}?`)) {
                              deletePlan.mutate(plan.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Document Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open);
        if (!open) {
          setSelectedPlanForUpload(null);
          setUploadFile(null);
          setUploadDocType("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Plan Document</DialogTitle>
            <DialogDescription>Upload required plan documents (SOB, EOC, ANOC, etc.)</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {missingDocs.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 p-3 rounded-md">
                <p className="text-sm font-medium flex items-center gap-2 text-orange-900 dark:text-orange-100">
                  <AlertTriangle className="w-4 h-4" />
                  Missing Documents
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                  {missingDocs.join(", ")}
                </p>
              </div>
            )}

            {selectedPlanDocs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Documents:</p>
                {selectedPlanDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">{doc.documentType}</span>
                      <span className="text-xs text-muted-foreground">{doc.fileName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="doc-type">Document Type</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger id="doc-type" data-testid="select-doc-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOB">Summary of Benefits (SOB)</SelectItem>
                  <SelectItem value="EOC">Evidence of Coverage (EOC)</SelectItem>
                  <SelectItem value="ANOC">Annual Notice of Change (ANOC)</SelectItem>
                  <SelectItem value="PROVIDER_LIST">Provider Directory</SelectItem>
                  <SelectItem value="DRUG_FORMULARY">Drug Formulary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                data-testid="input-doc-file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              data-testid="button-upload-submit"
              onClick={() => {
                if (selectedPlanForUpload && uploadFile && uploadDocType) {
                  uploadDocument.mutate({
                    planId: selectedPlanForUpload,
                    file: uploadFile,
                    docType: uploadDocType,
                  });
                }
              }}
              disabled={!uploadFile || !uploadDocType || uploadDocument.isPending}
            >
              {uploadDocument.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
