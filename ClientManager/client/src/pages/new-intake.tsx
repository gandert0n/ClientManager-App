import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Upload, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertClientSchema, type InsertClient, type Carrier, type Plan } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DrugAutocomplete } from "@/components/drug-autocomplete";
import { Separator } from "@/components/ui/separator";

export default function NewIntake() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [medications, setMedications] = useState<{ drugName: string; dosage?: string }[]>([]);
  const [doctors, setDoctors] = useState<{ name: string; specialty?: string; phoneNumber?: string }[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | undefined>();
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrPreviewData, setOcrPreviewData] = useState<Partial<InsertClient> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddCarrierDialogOpen, setIsAddCarrierDialogOpen] = useState(false);
  const [isAddPlanDialogOpen, setIsAddPlanDialogOpen] = useState(false);
  const [newCarrierName, setNewCarrierName] = useState("");
  const [newPlanData, setNewPlanData] = useState({
    name: "",
    planYear: new Date().getFullYear(),
    monthlyPremium: "",
    annualDeductible: "",
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
    defaultValues: {
      fullName: "",
      birthdate: "",
      phoneNumber: "",
      medicareNumber: "",
      partAStartDate: "",
      partBStartDate: "",
      carrierId: undefined,
      planId: undefined,
      socialSecurityNumber: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      county: "",
      status: "pending",
      clientStatus: "prospect",
      spokeWithThisAep: false,
      continueWithCurrentPlan: false,
    },
  });

  // Handle OCR document processing
  const processOCRFile = async (file: File) => {
    setIsProcessingOCR(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ocr/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "OCR processing failed");
      }

      const data = await response.json();
      setOcrPreviewData(data);

      toast({
        title: "Document processed",
        description: "Review the extracted information and confirm to auto-fill the form.",
      });
    } catch (error) {
      toast({
        title: "OCR processing failed",
        description: error instanceof Error ? error.message : "Failed to extract data from document. Please fill the form manually.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Handle file input change
  const handleOCRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processOCRFile(file);
      event.target.value = "";
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      await processOCRFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image or PDF file.",
        variant: "destructive",
      });
    }
  };

  // Confirm and apply OCR data to form
  const applyOCRData = () => {
    if (!ocrPreviewData) return;

    if (ocrPreviewData.fullName) form.setValue("fullName", ocrPreviewData.fullName);
    if (ocrPreviewData.birthdate) form.setValue("birthdate", ocrPreviewData.birthdate);
    if (ocrPreviewData.phoneNumber) form.setValue("phoneNumber", ocrPreviewData.phoneNumber);
    if (ocrPreviewData.medicareNumber) form.setValue("medicareNumber", ocrPreviewData.medicareNumber);
    if (ocrPreviewData.socialSecurityNumber) form.setValue("socialSecurityNumber", ocrPreviewData.socialSecurityNumber);
    if (ocrPreviewData.address) form.setValue("address", ocrPreviewData.address);
    if (ocrPreviewData.city) form.setValue("city", ocrPreviewData.city);
    if (ocrPreviewData.state) form.setValue("state", ocrPreviewData.state);
    if (ocrPreviewData.zipCode) form.setValue("zipCode", ocrPreviewData.zipCode);

    setOcrPreviewData(null);
    toast({
      title: "Form updated",
      description: "Client information has been auto-filled. Please review all fields.",
    });
  };

  const createClientMutation = useMutation({
    mutationFn: async (data: InsertClient & { medications: typeof medications; doctors: typeof doctors }) => {
      return await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client intake form submitted successfully.",
      });
      setLocation("/records");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit intake form. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createCarrierMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/carriers", { name });
    },
    onSuccess: (newCarrier: Carrier) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      setIsAddCarrierDialogOpen(false);
      setNewCarrierName("");
      form.setValue("carrierId", newCarrier.id);
      setSelectedCarrierId(newCarrier.id);
      form.setValue("planId", undefined);
      toast({
        title: "Success",
        description: `Carrier "${newCarrier.name}" created successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create carrier. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData: { name: string; planYear: number; carrierId: number; monthlyPremium?: string; annualDeductible?: string }) => {
      const payload: any = {
        name: planData.name,
        planYear: planData.planYear,
        carrierId: planData.carrierId,
      };
      if (planData.monthlyPremium) {
        payload.monthlyPremium = planData.monthlyPremium;
      }
      if (planData.annualDeductible) {
        payload.annualDeductible = planData.annualDeductible;
      }
      return await apiRequest("POST", "/api/plans", payload);
    },
    onSuccess: (newPlan: Plan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans", selectedCarrierId] });
      setIsAddPlanDialogOpen(false);
      setNewPlanData({
        name: "",
        planYear: new Date().getFullYear(),
        monthlyPremium: "",
        annualDeductible: "",
      });
      form.setValue("planId", newPlan.id);
      toast({
        title: "Success",
        description: `Plan "${newPlan.name}" created successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    createClientMutation.mutate({ ...data, medications, doctors });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">New Client Intake</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the form below to register a new client.
          </p>
        </div>

        {/* OCR Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Client Document (Optional)
            </CardTitle>
            <CardDescription>
              Upload a scan or photo of a Medicare card, insurance form, or intake document to auto-fill the form below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="dropzone-ocr"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drag and drop your document here, or click to browse
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={isProcessingOCR}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-document"
              >
                {isProcessingOCR ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleOCRUpload}
                disabled={isProcessingOCR}
                data-testid="input-ocr-file"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports images and PDF files
              </p>
            </div>

            {/* OCR Preview/Confirmation */}
            {ocrPreviewData && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-base">Extracted Information - Review & Confirm</CardTitle>
                  <CardDescription>
                    Review the extracted data below and confirm to auto-fill the form
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {ocrPreviewData.fullName && (
                      <div>
                        <p className="text-muted-foreground">Full Name</p>
                        <p className="font-medium" data-testid="text-ocr-preview-name">{ocrPreviewData.fullName}</p>
                      </div>
                    )}
                    {ocrPreviewData.birthdate && (
                      <div>
                        <p className="text-muted-foreground">Birth Date</p>
                        <p className="font-medium" data-testid="text-ocr-preview-birthdate">{ocrPreviewData.birthdate}</p>
                      </div>
                    )}
                    {ocrPreviewData.medicareNumber && (
                      <div>
                        <p className="text-muted-foreground">Medicare Number</p>
                        <p className="font-medium font-mono" data-testid="text-ocr-preview-medicare">{ocrPreviewData.medicareNumber}</p>
                      </div>
                    )}
                    {ocrPreviewData.phoneNumber && (
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium" data-testid="text-ocr-preview-phone">{ocrPreviewData.phoneNumber}</p>
                      </div>
                    )}
                    {ocrPreviewData.address && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Address</p>
                        <p className="font-medium" data-testid="text-ocr-preview-address">
                          {ocrPreviewData.address}
                          {ocrPreviewData.city && `, ${ocrPreviewData.city}`}
                          {ocrPreviewData.state && `, ${ocrPreviewData.state}`}
                          {ocrPreviewData.zipCode && ` ${ocrPreviewData.zipCode}`}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={applyOCRData}
                      data-testid="button-confirm-ocr"
                    >
                      Confirm & Auto-Fill Form
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOcrPreviewData(null)}
                      data-testid="button-cancel-ocr"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-full-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="birthdate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-birthdate" />
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
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 123-4567"
                            {...field}
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Client Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Client Status</CardTitle>
                <CardDescription>
                  Indicate whether this is a current client or a prospect
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="clientStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-client-status">
                            <SelectValue placeholder="Select client status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="current_client">Current Client</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Medicare Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Medicare Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="medicareNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medicare Number *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1EG4-TE5-MK73"
                          className="font-mono"
                          {...field}
                          data-testid="input-medicare-number"
                        />
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
                          <Input type="date" {...field} data-testid="input-part-a-date" />
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
                          <Input type="date" {...field} data-testid="input-part-b-date" />
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
                <CardTitle className="text-lg">Current Plan (Optional)</CardTitle>
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
                            if (value === "_add_new_") {
                              setIsAddCarrierDialogOpen(true);
                              return;
                            }
                            const carrierId = value ? parseInt(value) : undefined;
                            field.onChange(carrierId);
                            setSelectedCarrierId(carrierId);
                            form.setValue("currentPlanId", undefined);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-carrier">
                              <SelectValue placeholder="Select a carrier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_add_new_">
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Add New Carrier</span>
                              </div>
                            </SelectItem>
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
                          onValueChange={(value) => {
                            if (value === "_add_new_") {
                              if (!selectedCarrierId) {
                                toast({
                                  title: "Select a carrier first",
                                  description: "Please select a carrier before adding a new plan.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              setIsAddPlanDialogOpen(true);
                              return;
                            }
                            field.onChange(value ? parseInt(value) : undefined);
                          }}
                          disabled={!selectedCarrierId}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-plan">
                              <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_add_new_" disabled={!selectedCarrierId}>
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                <span>Add New Plan</span>
                              </div>
                            </SelectItem>
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

            {/* AEP Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AEP Tracking</CardTitle>
                <CardDescription>Annual Enrollment Period contact status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="spokeWithThisAep"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-spoke-with-aep"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Spoke with client this AEP</FormLabel>
                        <FormDescription>
                          Check if you've contacted the client during this enrollment period
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="continueWithCurrentPlan"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-continue-plan"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Client continuing with current plan</FormLabel>
                        <FormDescription>
                          Check if client decided to keep their existing plan
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Identity & Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Identity & Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="socialSecurityNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Social Security Number *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="XXX-XX-XXXX"
                          className="font-mono"
                          {...field}
                          data-testid="input-ssn"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main Street"
                          {...field}
                          data-testid="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="Springfield" {...field} data-testid="input-city" />
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
                          <Input placeholder="IL" maxLength={2} {...field} data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., King County" {...field} data-testid="input-county" />
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
                          <Input placeholder="62701" {...field} data-testid="input-zip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medications */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Medications</CardTitle>
              </CardHeader>
              <CardContent>
                <DrugAutocomplete
                  medications={medications}
                  onAddMedication={(med) => setMedications([...medications, med])}
                  onRemoveMedication={(index) => 
                    setMedications(medications.filter((_, i) => i !== index))
                  }
                />
              </CardContent>
            </Card>

            {/* Doctors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Doctors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {doctors.map((doctor, index) => (
                  <div key={index} className="flex gap-4 items-start p-4 border rounded-md">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="text-sm font-medium">Name *</label>
                        <Input
                          value={doctor.name}
                          onChange={(e) => {
                            const newDoctors = [...doctors];
                            newDoctors[index].name = e.target.value;
                            setDoctors(newDoctors);
                          }}
                          placeholder="Dr. Smith"
                          data-testid={`input-doctor-name-${index}`}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Specialty</label>
                          <Select
                            value={doctor.specialty || ""}
                            onValueChange={(value) => {
                              const newDoctors = [...doctors];
                              newDoctors[index].specialty = value;
                              setDoctors(newDoctors);
                            }}
                          >
                            <SelectTrigger data-testid={`select-doctor-specialty-${index}`}>
                              <SelectValue placeholder="Select specialty" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Primary Care">Primary Care</SelectItem>
                              <SelectItem value="Dentist">Dentist</SelectItem>
                              <SelectItem value="Cardiologist">Cardiologist</SelectItem>
                              <SelectItem value="Endocrinologist">Endocrinologist</SelectItem>
                              <SelectItem value="Nephrologist">Nephrologist</SelectItem>
                              <SelectItem value="Neurologist">Neurologist</SelectItem>
                              <SelectItem value="Oncologist">Oncologist</SelectItem>
                              <SelectItem value="Orthopedist">Orthopedist</SelectItem>
                              <SelectItem value="Pulmonologist">Pulmonologist</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Phone Number</label>
                          <Input
                            value={doctor.phoneNumber || ""}
                            onChange={(e) => {
                              const newDoctors = [...doctors];
                              newDoctors[index].phoneNumber = e.target.value;
                              setDoctors(newDoctors);
                            }}
                            placeholder="(555) 123-4567"
                            data-testid={`input-doctor-phone-${index}`}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDoctors(doctors.filter((_, i) => i !== index))}
                      data-testid={`button-remove-doctor-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDoctors([...doctors, { name: "", specialty: "", phoneNumber: "" }])}
                  className="w-full"
                  data-testid="button-add-doctor"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Doctor
                </Button>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={createClientMutation.isPending}
                className="flex-1 md:flex-none"
                data-testid="button-submit-intake"
              >
                {createClientMutation.isPending ? "Submitting..." : "Submit Intake"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/records")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>

        {/* Add New Carrier Dialog */}
        <Dialog open={isAddCarrierDialogOpen} onOpenChange={setIsAddCarrierDialogOpen}>
          <DialogContent data-testid="dialog-add-carrier">
            <DialogHeader>
              <DialogTitle>Add New Carrier</DialogTitle>
              <DialogDescription>
                Create a new insurance carrier to add to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Carrier Name *</label>
                <Input
                  value={newCarrierName}
                  onChange={(e) => setNewCarrierName(e.target.value)}
                  placeholder="e.g., Blue Cross Blue Shield"
                  data-testid="input-new-carrier-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddCarrierDialogOpen(false);
                  setNewCarrierName("");
                }}
                disabled={createCarrierMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newCarrierName.trim()) {
                    toast({
                      title: "Carrier name required",
                      description: "Please enter a carrier name.",
                      variant: "destructive",
                    });
                    return;
                  }
                  createCarrierMutation.mutate(newCarrierName.trim());
                }}
                disabled={createCarrierMutation.isPending}
                data-testid="button-create-carrier"
              >
                {createCarrierMutation.isPending ? "Creating..." : "Create Carrier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add New Plan Dialog */}
        <Dialog open={isAddPlanDialogOpen} onOpenChange={setIsAddPlanDialogOpen}>
          <DialogContent data-testid="dialog-add-plan">
            <DialogHeader>
              <DialogTitle>Add New Plan</DialogTitle>
              <DialogDescription>
                Create a new insurance plan for the selected carrier
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Plan Name *</label>
                <Input
                  value={newPlanData.name}
                  onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                  placeholder="e.g., Medicare Advantage Plus"
                  data-testid="input-new-plan-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Plan Year *</label>
                <Input
                  type="number"
                  value={newPlanData.planYear}
                  onChange={(e) => setNewPlanData({ ...newPlanData, planYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  placeholder="2024"
                  data-testid="input-new-plan-year"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Monthly Premium</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPlanData.monthlyPremium}
                    onChange={(e) => setNewPlanData({ ...newPlanData, monthlyPremium: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-new-plan-premium"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Annual Deductible</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPlanData.annualDeductible}
                    onChange={(e) => setNewPlanData({ ...newPlanData, annualDeductible: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-new-plan-deductible"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddPlanDialogOpen(false);
                  setNewPlanData({
                    name: "",
                    planYear: new Date().getFullYear(),
                    monthlyPremium: "",
                    annualDeductible: "",
                  });
                }}
                disabled={createPlanMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newPlanData.name.trim()) {
                    toast({
                      title: "Plan name required",
                      description: "Please enter a plan name.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!selectedCarrierId) {
                    toast({
                      title: "Carrier required",
                      description: "Please select a carrier first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  createPlanMutation.mutate({
                    name: newPlanData.name.trim(),
                    planYear: newPlanData.planYear,
                    carrierId: selectedCarrierId,
                    monthlyPremium: newPlanData.monthlyPremium,
                    annualDeductible: newPlanData.annualDeductible,
                  });
                }}
                disabled={createPlanMutation.isPending}
                data-testid="button-create-plan"
              >
                {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
