import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, FileText, PlusCircle, Upload, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Carrier, Plan, PlanDocument } from "@shared/schema";

export default function Plans() {
  const { toast } = useToast();
  const [newCarrierName, setNewCarrierName] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanYear, setNewPlanYear] = useState(new Date().getFullYear().toString());
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");
  const [isCarrierDialogOpen, setIsCarrierDialogOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isBenefitsDialogOpen, setIsBenefitsDialogOpen] = useState(false);
  const [extractedBenefits, setExtractedBenefits] = useState<any>(null);
  const [benefitsPlanId, setBenefitsPlanId] = useState<number | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedPlanData, setEditedPlanData] = useState<Partial<Plan>>({});
  const [carrierToDelete, setCarrierToDelete] = useState<Carrier | null>(null);

  // Fetch carriers
  const { data: carriers = [], isLoading: loadingCarriers } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
    queryFn: () => fetch("/api/carriers").then(res => res.json()),
  });

  // Fetch plans for selected carrier
  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ["/api/plans", selectedCarrierId],
    queryFn: () => 
      fetch(selectedCarrierId ? `/api/plans?carrierId=${selectedCarrierId}` : "/api/plans")
        .then(res => res.json()),
  });

  // Fetch selected plan with documents
  const { data: selectedPlan, isLoading: loadingPlanDetails } = useQuery<Plan & {
    carrier: Carrier;
    documents: PlanDocument[];
  }>({
    queryKey: ["/api/plans", selectedPlanId, "details"],
    queryFn: () => fetch(`/api/plans/${selectedPlanId}`).then(res => res.json()),
    enabled: selectedPlanId !== null,
  });

  // Fetch missing documents for selected plan
  const { data: missingDocs = [] } = useQuery<string[]>({
    queryKey: ["/api/plans", selectedPlanId, "missing-documents"],
    queryFn: () => fetch(`/api/plans/${selectedPlanId}/missing-documents`).then(res => res.json()),
    enabled: selectedPlanId !== null,
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
    mutationFn: async (carrierId: number) => {
      return apiRequest("DELETE", `/api/carriers/${carrierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      if (selectedCarrierId === carrierToDelete?.id) {
        setSelectedCarrierId(null);
        setSelectedPlanId(null);
      }
      setCarrierToDelete(null);
      toast({ title: "Carrier deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete carrier", variant: "destructive" });
      setCarrierToDelete(null);
    },
  });

  // Create plan mutation
  const createPlan = useMutation({
    mutationFn: async (data: { name: string; carrierId: number; planYear: number }) => {
      return apiRequest("POST", "/api/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setNewPlanName("");
      setNewPlanYear(new Date().getFullYear().toString());
      setIsPlanDialogOpen(false);
      toast({ title: "Plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create plan", variant: "destructive" });
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

      const result = await response.json();

      // If it's an SOB, also try to extract benefits using OCR
      if (docType === "SOB") {
        try {
          const ocrFormData = new FormData();
          ocrFormData.append("files", file);
          
          const ocrResponse = await fetch("/api/ocr/upload", {
            method: "POST",
            body: ocrFormData,
          });

          if (ocrResponse.ok) {
            const ocrData = await ocrResponse.json();
            // Check if any benefits were extracted
            const uploadResult = ocrData.results?.[0];
            if (uploadResult?.extractedBenefits && Object.keys(uploadResult.extractedBenefits).length > 0) {
              return { ...result, extractedBenefits: uploadResult.extractedBenefits, planId };
            }
          }
        } catch (ocrError) {
          console.warn("OCR extraction failed, continuing without benefits:", ocrError);
        }
      }

      return result;
    },
    onSuccess: (data) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanId, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanId, "missing-documents"] });
      setUploadFile(null);
      setUploadDocType("");
      setIsUploadDialogOpen(false);
      
      // If benefits were extracted, show them
      if (data.extractedBenefits && Object.keys(data.extractedBenefits).length > 0) {
        setExtractedBenefits(data.extractedBenefits);
        setBenefitsPlanId(data.planId || selectedPlanId);
        setIsBenefitsDialogOpen(true);
        toast({ title: "Document uploaded and benefits extracted!" });
      } else {
        toast({ title: "Document uploaded successfully" });
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Apply benefits mutation
  const applyBenefits = useMutation({
    mutationFn: async ({ planId, benefits }: { planId: number; benefits: any }) => {
      const result = await apiRequest("PATCH", `/api/plans/${planId}/apply-benefits`, { extractedBenefits: benefits });
      return result as unknown as { message: string; plan: Plan; appliedFields: string[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", benefitsPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", benefitsPlanId, "details"] });
      setIsBenefitsDialogOpen(false);
      setExtractedBenefits(null);
      setBenefitsPlanId(null);
      toast({ 
        title: "Benefits applied successfully",
        description: `Updated ${data.appliedFields?.length || 0} field(s)`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to apply benefits", variant: "destructive" });
    },
  });

  // Update plan mutation
  const updatePlan = useMutation({
    mutationFn: async ({ planId, data }: { planId: number; data: Partial<Plan> }) => {
      return apiRequest("PATCH", `/api/plans/${planId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedPlanId, "details"] });
      setIsEditingPlan(false);
      setEditedPlanData({});
      toast({ title: "Plan updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    },
  });

  const handleCreateCarrier = () => {
    if (newCarrierName.trim()) {
      createCarrier.mutate(newCarrierName.trim());
    }
  };

  const handleCreatePlan = () => {
    if (newPlanName.trim() && selectedCarrierId) {
      createPlan.mutate({
        name: newPlanName.trim(),
        carrierId: selectedCarrierId,
        planYear: parseInt(newPlanYear),
      });
    }
  };

  const handleUploadDocument = () => {
    if (uploadFile && uploadDocType && selectedPlanId) {
      uploadDocument.mutate({
        planId: selectedPlanId,
        file: uploadFile,
        docType: uploadDocType,
      });
    }
  };

  const handleEditPlan = () => {
    if (selectedPlan) {
      setEditedPlanData(selectedPlan);
      setIsEditingPlan(true);
    }
  };

  const handleSavePlan = () => {
    if (selectedPlanId && editedPlanData) {
      // Convert counties string to array if it's a string
      const dataToSave: any = { ...editedPlanData };
      if (typeof dataToSave.counties === 'string') {
        dataToSave.counties = dataToSave.counties
          .split(',')
          .map((c: string) => c.trim())
          .filter(Boolean);
      }
      updatePlan.mutate({ planId: selectedPlanId, data: dataToSave });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPlan(false);
    setEditedPlanData({});
  };

  const updateField = (field: keyof Plan, value: any) => {
    setEditedPlanData(prev => ({ ...prev, [field]: value }));
  };

  const documentTypeLabels: Record<string, string> = {
    SOB: "Summary of Benefits",
    EOC: "Evidence of Coverage",
    ANOC: "Annual Notice of Changes",
    PROVIDER_LIST: "Provider List",
    DRUG_FORMULARY: "Drug Formulary",
  };

  if (loadingCarriers) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading plans...</p>
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
            <h1 className="text-2xl font-semibold text-foreground">Plan Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage insurance carriers, plans, and documents
            </p>
          </div>
          <Dialog open={isCarrierDialogOpen} onOpenChange={setIsCarrierDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-carrier">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Carrier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Carrier</DialogTitle>
                <DialogDescription>
                  Add a new insurance carrier to the system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier-name">Carrier Name</Label>
                  <Input
                    id="carrier-name"
                    data-testid="input-carrier-name"
                    placeholder="e.g., Blue Cross Blue Shield"
                    value={newCarrierName}
                    onChange={(e) => setNewCarrierName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateCarrier}
                  disabled={!newCarrierName.trim() || createCarrier.isPending}
                  data-testid="button-create-carrier"
                >
                  {createCarrier.isPending ? "Creating..." : "Create Carrier"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Carriers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {carriers.map((carrier) => (
            <Card
              key={carrier.id}
              className={`cursor-pointer transition-all ${
                selectedCarrierId === carrier.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedCarrierId(carrier.id)}
              data-testid={`card-carrier-${carrier.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {carrier.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCarrierToDelete(carrier);
                    }}
                    data-testid={`button-delete-carrier-${carrier.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Plans Section */}
        {selectedCarrierId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Plans</h2>
              <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-new-plan">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Plan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Plan</DialogTitle>
                    <DialogDescription>
                      Add a new insurance plan for this carrier
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="plan-name">Plan Name</Label>
                      <Input
                        id="plan-name"
                        data-testid="input-plan-name"
                        placeholder="e.g., Medicare Advantage Plus"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-year">Plan Year</Label>
                      <Input
                        id="plan-year"
                        data-testid="input-plan-year"
                        type="number"
                        value={newPlanYear}
                        onChange={(e) => setNewPlanYear(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreatePlan}
                      disabled={!newPlanName.trim() || createPlan.isPending}
                      data-testid="button-create-plan"
                    >
                      {createPlan.isPending ? "Creating..." : "Create Plan"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {loadingPlans ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all ${
                      selectedPlanId === plan.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <CardDescription className="space-y-1">
                        <div>Year: {plan.planYear}</div>
                        {plan.planNumber && <div className="text-xs">Plan #: {plan.planNumber}</div>}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comprehensive Plan Details Section */}
        {selectedPlanId && selectedPlan && (
          <div className="mt-8 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {isEditingPlan ? (
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="plan-name-edit">Plan Name</Label>
                          <Input
                            id="plan-name-edit"
                            value={editedPlanData.name || ''}
                            onChange={(e) => updateField('name', e.target.value)}
                            data-testid="input-plan-name-edit"
                          />
                        </div>
                        <CardDescription>Year: {selectedPlan.planYear} | Carrier: {selectedPlan.carrier.name}</CardDescription>
                      </div>
                    ) : (
                      <div>
                        <CardTitle>Plan Details - {selectedPlan.name}</CardTitle>
                        <CardDescription>Year: {selectedPlan.planYear} | Carrier: {selectedPlan.carrier.name}</CardDescription>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isEditingPlan ? (
                      <Button onClick={handleEditPlan} data-testid="button-edit-plan">
                        Edit Details
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleSavePlan} disabled={updatePlan.isPending} data-testid="button-save-plan">
                          {updatePlan.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <Label htmlFor="planNumber">Plan Number</Label>
                    <Input
                      id="planNumber"
                      value={isEditingPlan ? (editedPlanData.planNumber || '') : (selectedPlan.planNumber || 'N/A')}
                      onChange={(e) => updateField('planNumber', e.target.value)}
                      disabled={!isEditingPlan}
                      placeholder="e.g., H1234-001"
                      data-testid="input-plan-number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planType">Plan Type</Label>
                    <Input
                      id="planType"
                      value={isEditingPlan ? (editedPlanData.planType || '') : (selectedPlan.planType || 'N/A')}
                      onChange={(e) => updateField('planType', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-plan-type"
                    />
                  </div>

                  {/* Premium & Costs */}
                  <div className="space-y-2">
                    <Label htmlFor="monthlyPremium">Monthly Premium</Label>
                    <Input
                      id="monthlyPremium"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.monthlyPremium || '') : (selectedPlan.monthlyPremium || 'N/A')}
                      onChange={(e) => updateField('monthlyPremium', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-monthly-premium"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="annualDeductible">Annual Deductible</Label>
                    <Input
                      id="annualDeductible"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.annualDeductible || '') : (selectedPlan.annualDeductible || 'N/A')}
                      onChange={(e) => updateField('annualDeductible', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-annual-deductible"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxOutOfPocket">Max Out-of-Pocket (In-Network)</Label>
                    <Input
                      id="maxOutOfPocket"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.maxOutOfPocket || '') : (selectedPlan.maxOutOfPocket || 'N/A')}
                      onChange={(e) => updateField('maxOutOfPocket', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-max-oop"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxOutOfPocketOutNetwork">Max Out-of-Pocket (Out-of-Network)</Label>
                    <Input
                      id="maxOutOfPocketOutNetwork"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.maxOutOfPocketOutNetwork || '') : (selectedPlan.maxOutOfPocketOutNetwork || 'N/A')}
                      onChange={(e) => updateField('maxOutOfPocketOutNetwork', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-max-oop-out-network"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="partBGiveback">Part B Premium Reduction</Label>
                    <Input
                      id="partBGiveback"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.partBGiveback || '') : (selectedPlan.partBGiveback || 'N/A')}
                      onChange={(e) => updateField('partBGiveback', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-part-b-giveback"
                    />
                  </div>

                  {/* Copays */}
                  <div className="space-y-2">
                    <Label htmlFor="primaryCareCopay">Primary Care Copay</Label>
                    <Input
                      id="primaryCareCopay"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.primaryCareCopay || '') : (selectedPlan.primaryCareCopay || 'N/A')}
                      onChange={(e) => updateField('primaryCareCopay', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-primary-care-copay"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialistCopay">Specialist Copay</Label>
                    <Input
                      id="specialistCopay"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.specialistCopay || '') : (selectedPlan.specialistCopay || 'N/A')}
                      onChange={(e) => updateField('specialistCopay', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-specialist-copay"
                    />
                  </div>

                  {/* Additional Benefits */}
                  <div className="space-y-2">
                    <Label htmlFor="dentalAllowance">Dental Allowance</Label>
                    <Input
                      id="dentalAllowance"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.dentalAllowance || '') : (selectedPlan.dentalAllowance || 'N/A')}
                      onChange={(e) => updateField('dentalAllowance', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-dental-allowance"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otcCredit">OTC Credit</Label>
                    <Input
                      id="otcCredit"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.otcCredit || '') : (selectedPlan.otcCredit || 'N/A')}
                      onChange={(e) => updateField('otcCredit', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-otc-credit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otcCreditFrequency">OTC Frequency</Label>
                    <Select
                      value={isEditingPlan ? (editedPlanData.otcCreditFrequency || '') : (selectedPlan.otcCreditFrequency || '')}
                      onValueChange={(value) => updateField('otcCreditFrequency', value)}
                      disabled={!isEditingPlan}
                    >
                      <SelectTrigger id="otcCreditFrequency" data-testid="select-otc-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="benefitCard">Benefit Card</Label>
                    <Input
                      id="benefitCard"
                      value={isEditingPlan ? (editedPlanData.benefitCard || '') : (selectedPlan.benefitCard || 'N/A')}
                      onChange={(e) => updateField('benefitCard', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-benefit-card"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="benefitCardFrequency">Benefit Card Frequency</Label>
                    <Select
                      value={isEditingPlan ? (editedPlanData.benefitCardFrequency || '') : (selectedPlan.benefitCardFrequency || '')}
                      onValueChange={(value) => updateField('benefitCardFrequency', value)}
                      disabled={!isEditingPlan}
                    >
                      <SelectTrigger id="benefitCardFrequency" data-testid="select-benefit-card-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fitnessOption">Fitness Program</Label>
                    <Input
                      id="fitnessOption"
                      value={isEditingPlan ? (editedPlanData.fitnessOption || '') : (selectedPlan.fitnessOption || 'N/A')}
                      onChange={(e) => updateField('fitnessOption', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-fitness-option"
                    />
                  </div>

                  {/* Hospital Care */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="inpatientHospitalCare">Inpatient Hospital Care</Label>
                    <Input
                      id="inpatientHospitalCare"
                      value={isEditingPlan ? (editedPlanData.inpatientHospitalCare || '') : (selectedPlan.inpatientHospitalCare || 'N/A')}
                      onChange={(e) => updateField('inpatientHospitalCare', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-inpatient-care"
                    />
                  </div>

                  {/* Prescription Info */}
                  <div className="space-y-2">
                    <Label htmlFor="prescriptionDeductible">Prescription Deductible</Label>
                    <Input
                      id="prescriptionDeductible"
                      type="number"
                      step="0.01"
                      value={isEditingPlan ? (editedPlanData.prescriptionDeductible || '') : (selectedPlan.prescriptionDeductible || 'N/A')}
                      onChange={(e) => updateField('prescriptionDeductible', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-rx-deductible"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prescriptionDeductibleTiers">Deductible Tiers</Label>
                    <Select
                      value={isEditingPlan ? (editedPlanData.prescriptionDeductibleTiers || '') : (selectedPlan.prescriptionDeductibleTiers || '')}
                      onValueChange={(value) => updateField('prescriptionDeductibleTiers', value)}
                      disabled={!isEditingPlan}
                    >
                      <SelectTrigger id="prescriptionDeductibleTiers" data-testid="select-rx-deductible-tiers">
                        <SelectValue placeholder="Select tiers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-5">1-5</SelectItem>
                        <SelectItem value="3-5">3-5</SelectItem>
                        <SelectItem value="4-5">4-5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Drug Tiers */}
                  <div className="space-y-2">
                    <Label>Tier 1 Drugs</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tier1Drugs"
                        value={isEditingPlan ? (editedPlanData.tier1Drugs || '') : (selectedPlan.tier1Drugs || 'N/A')}
                        onChange={(e) => updateField('tier1Drugs', e.target.value)}
                        disabled={!isEditingPlan}
                        className="flex-1"
                        data-testid="input-tier1-drugs"
                      />
                      <Select
                        value={isEditingPlan ? (editedPlanData.tier1DrugsType || '$') : (selectedPlan.tier1DrugsType || '$')}
                        onValueChange={(value) => updateField('tier1DrugsType', value)}
                        disabled={!isEditingPlan}
                      >
                        <SelectTrigger className="w-20" data-testid="select-tier1-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="$">$</SelectItem>
                          <SelectItem value="%">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tier 2 Drugs</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tier2Drugs"
                        value={isEditingPlan ? (editedPlanData.tier2Drugs || '') : (selectedPlan.tier2Drugs || 'N/A')}
                        onChange={(e) => updateField('tier2Drugs', e.target.value)}
                        disabled={!isEditingPlan}
                        className="flex-1"
                        data-testid="input-tier2-drugs"
                      />
                      <Select
                        value={isEditingPlan ? (editedPlanData.tier2DrugsType || '$') : (selectedPlan.tier2DrugsType || '$')}
                        onValueChange={(value) => updateField('tier2DrugsType', value)}
                        disabled={!isEditingPlan}
                      >
                        <SelectTrigger className="w-20" data-testid="select-tier2-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="$">$</SelectItem>
                          <SelectItem value="%">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tier 3 Drugs</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tier3Drugs"
                        value={isEditingPlan ? (editedPlanData.tier3Drugs || '') : (selectedPlan.tier3Drugs || 'N/A')}
                        onChange={(e) => updateField('tier3Drugs', e.target.value)}
                        disabled={!isEditingPlan}
                        className="flex-1"
                        data-testid="input-tier3-drugs"
                      />
                      <Select
                        value={isEditingPlan ? (editedPlanData.tier3DrugsType || '%') : (selectedPlan.tier3DrugsType || '%')}
                        onValueChange={(value) => updateField('tier3DrugsType', value)}
                        disabled={!isEditingPlan}
                      >
                        <SelectTrigger className="w-20" data-testid="select-tier3-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="$">$</SelectItem>
                          <SelectItem value="%">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tier 4 Drugs</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tier4Drugs"
                        value={isEditingPlan ? (editedPlanData.tier4Drugs || '') : (selectedPlan.tier4Drugs || 'N/A')}
                        onChange={(e) => updateField('tier4Drugs', e.target.value)}
                        disabled={!isEditingPlan}
                        className="flex-1"
                        data-testid="input-tier4-drugs"
                      />
                      <Select
                        value={isEditingPlan ? (editedPlanData.tier4DrugsType || '%') : (selectedPlan.tier4DrugsType || '%')}
                        onValueChange={(value) => updateField('tier4DrugsType', value)}
                        disabled={!isEditingPlan}
                      >
                        <SelectTrigger className="w-20" data-testid="select-tier4-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="$">$</SelectItem>
                          <SelectItem value="%">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tier 5 Drugs</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tier5Drugs"
                        value={isEditingPlan ? (editedPlanData.tier5Drugs || '') : (selectedPlan.tier5Drugs || 'N/A')}
                        onChange={(e) => updateField('tier5Drugs', e.target.value)}
                        disabled={!isEditingPlan}
                        className="flex-1"
                        data-testid="input-tier5-drugs"
                      />
                      <Select
                        value={isEditingPlan ? (editedPlanData.tier5DrugsType || '%') : (selectedPlan.tier5DrugsType || '%')}
                        onValueChange={(value) => updateField('tier5DrugsType', value)}
                        disabled={!isEditingPlan}
                      >
                        <SelectTrigger className="w-20" data-testid="select-tier5-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="$">$</SelectItem>
                          <SelectItem value="%">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Special Program Info */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="medicaidLevels">Medicaid Levels (D-SNP)</Label>
                    <Input
                      id="medicaidLevels"
                      value={isEditingPlan ? (editedPlanData.medicaidLevels || '') : (selectedPlan.medicaidLevels || 'N/A')}
                      onChange={(e) => updateField('medicaidLevels', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-medicaid-levels"
                    />
                  </div>

                  {/* Network Info */}
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="providerNetwork">Provider Network</Label>
                    <Input
                      id="providerNetwork"
                      value={isEditingPlan ? (editedPlanData.providerNetwork || '') : (selectedPlan.providerNetwork || 'N/A')}
                      onChange={(e) => updateField('providerNetwork', e.target.value)}
                      disabled={!isEditingPlan}
                      data-testid="input-provider-network"
                    />
                  </div>

                  {/* Market Service Area */}
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="counties" className="text-base font-semibold">Market Service Area</Label>
                    <Input
                      id="counties"
                      value={
                        isEditingPlan 
                          ? (typeof editedPlanData.counties === 'string' ? editedPlanData.counties : (editedPlanData.counties?.join(', ') || ''))
                          : (selectedPlan.counties?.join(', ') || 'N/A')
                      }
                      onChange={(e) => updateField('counties', e.target.value)}
                      disabled={!isEditingPlan}
                      placeholder="e.g., King, Pierce, Snohomish, Kitsap"
                      data-testid="input-counties"
                    />
                    <p className="text-xs text-muted-foreground">
                      Counties where this plan is available (comma-separated). The comparison engine matches plans based on the client's county.
                    </p>
                  </div>

                  {/* Commission Information */}
                  <div className="space-y-3 md:col-span-3">
                    <Label className="text-base font-semibold">Commission Information</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isNoncommissionable"
                        checked={isEditingPlan ? (editedPlanData.isNoncommissionable || false) : (selectedPlan.isNoncommissionable || false)}
                        onCheckedChange={(checked) => updateField('isNoncommissionable', checked)}
                        disabled={!isEditingPlan}
                        data-testid="checkbox-noncommissionable"
                      />
                      <Label htmlFor="isNoncommissionable" className="font-normal cursor-pointer">
                        Noncommissionable
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hasReducedCommissionIfTransferred"
                        checked={isEditingPlan ? (editedPlanData.hasReducedCommissionIfTransferred || false) : (selectedPlan.hasReducedCommissionIfTransferred || false)}
                        onCheckedChange={(checked) => updateField('hasReducedCommissionIfTransferred', checked)}
                        disabled={!isEditingPlan}
                        data-testid="checkbox-reduced-commission"
                      />
                      <Label htmlFor="hasReducedCommissionIfTransferred" className="font-normal cursor-pointer">
                        Reduced Commission if transferred to
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Plan Documents Section */}
        {selectedPlanId && selectedPlan && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Plan Documents</h2>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-upload-document">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Plan Document</DialogTitle>
                    <DialogDescription>
                      Upload a document for {selectedPlan.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="doc-type">Document Type</Label>
                      <Select value={uploadDocType} onValueChange={setUploadDocType}>
                        <SelectTrigger id="doc-type" data-testid="select-doc-type">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(documentTypeLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file">File</Label>
                      <Input
                        id="file"
                        data-testid="input-file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleUploadDocument}
                      disabled={!uploadFile || !uploadDocType || uploadDocument.isPending}
                      data-testid="button-confirm-upload"
                    >
                      {uploadDocument.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Missing Documents Alert */}
            {missingDocs.length > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                    <AlertTriangle className="h-5 w-5" />
                    Missing Documents
                  </CardTitle>
                  <CardDescription className="text-orange-700 dark:text-orange-300">
                    The following documents are missing for this plan:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {missingDocs.map((docType) => (
                      <Badge
                        key={docType}
                        variant="outline"
                        className="border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-200"
                        data-testid={`badge-missing-${docType}`}
                      >
                        {documentTypeLabels[docType] || docType}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Uploaded Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Uploaded Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlan.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {selectedPlan.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-md border"
                        data-testid={`doc-item-${doc.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {documentTypeLabels[doc.documentType] || doc.documentType}
                            </p>
                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                          </div>
                        </div>
                        <a
                          href={doc.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`link-download-${doc.id}`}
                        >
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Extracted Benefits Dialog */}
      <Dialog open={isBenefitsDialogOpen} onOpenChange={setIsBenefitsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Extracted Plan Benefits</DialogTitle>
            <DialogDescription>
              Benefits were extracted from the uploaded SOB document. Review and apply them to the plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {extractedBenefits && (
              <div className="grid grid-cols-2 gap-4">
                {extractedBenefits.monthlyPremium && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Monthly Premium</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.monthlyPremium}</p>
                  </div>
                )}
                {extractedBenefits.annualDeductible && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Annual Deductible</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.annualDeductible}</p>
                  </div>
                )}
                {extractedBenefits.maxOutOfPocket && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Max Out of Pocket</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.maxOutOfPocket}</p>
                  </div>
                )}
                {extractedBenefits.primaryCareCopay && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Primary Care Copay</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.primaryCareCopay}</p>
                  </div>
                )}
                {extractedBenefits.specialistCopay && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Specialist Copay</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.specialistCopay}</p>
                  </div>
                )}
                {extractedBenefits.prescriptionDeductible && (
                  <div className="p-3 rounded-md border bg-muted/50">
                    <Label className="text-xs text-muted-foreground">Prescription Deductible</Label>
                    <p className="text-lg font-semibold">${extractedBenefits.prescriptionDeductible}</p>
                  </div>
                )}
              </div>
            )}
            {(!extractedBenefits || Object.keys(extractedBenefits).length === 0) && (
              <p className="text-sm text-muted-foreground">No benefits could be extracted from the document.</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBenefitsDialogOpen(false)}
              data-testid="button-cancel-benefits"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (benefitsPlanId && extractedBenefits) {
                  applyBenefits.mutate({ planId: benefitsPlanId, benefits: extractedBenefits });
                }
              }}
              disabled={applyBenefits.isPending || !extractedBenefits || Object.keys(extractedBenefits).length === 0}
              data-testid="button-apply-benefits"
            >
              {applyBenefits.isPending ? "Applying..." : "Apply to Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Carrier Confirmation Dialog */}
      <AlertDialog open={carrierToDelete !== null} onOpenChange={() => setCarrierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Carrier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{carrierToDelete?.name}"? This will permanently delete the carrier and all associated plans and documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-carrier">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (carrierToDelete) {
                  deleteCarrier.mutate(carrierToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-carrier"
            >
              {deleteCarrier.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
