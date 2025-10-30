import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, MessageSquare, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Carrier, Plan } from "@shared/schema";

interface PlanComparisonData {
  comparisonId: number;
  clientId: number;
  createdAt: string;
  currentPlan: {
    id: number;
    name: string;
    carrierId: number;
    carrierName: string;
    monthlyPremium: string;
    annualDeductible: string;
    maxOutOfPocket: string;
    primaryCareCopay: string;
    specialistCopay: string;
    prescriptionDeductible: string;
    planType: string;
  };
  recommendedPlans: Array<{
    id: number;
    name: string;
    carrierId: number;
    carrierName: string;
    monthlyPremium: string;
    annualDeductible: string;
    maxOutOfPocket: string;
    primaryCareCopay: string;
    specialistCopay: string;
    prescriptionDeductible: string;
    planType: string;
    isCSnp: boolean;
    isDSnp: boolean;
    score: number;
    reasons: string[];
  }>;
}

interface Client {
  id: number;
  fullName: string;
  county: string;
}

export default function PlanComparison() {
  const { id, comparisonId } = useParams();
  const [, setLocation] = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const [selectedCarrierIds, setSelectedCarrierIds] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const didInitialize = useRef(false);

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", Number(id)],
    queryFn: () => fetch(`/api/clients/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: comparison, isLoading: comparisonLoading } = useQuery<PlanComparisonData>({
    queryKey: ["/api/comparisons", Number(comparisonId)],
    queryFn: () => fetch(`/api/comparisons/${comparisonId}`).then(res => res.json()),
    enabled: !!comparisonId,
  });

  // Fetch all carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
    queryFn: () => fetch("/api/carriers").then(res => res.json()),
  });

  // Fetch all available plans for selection
  const { data: availablePlans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => fetch("/api/plans").then(res => res.json()),
  });

  // Fetch individual plan details for selected plans
  const { data: selectedPlan1 } = useQuery<Plan>({
    queryKey: ["/api/plans", selectedPlanIds[0]],
    queryFn: () => fetch(`/api/plans/${selectedPlanIds[0]}`).then(res => res.json()),
    enabled: !!selectedPlanIds[0] && selectedPlanIds[0] !== comparison?.recommendedPlans[0]?.id,
  });

  const { data: selectedPlan2 } = useQuery<Plan>({
    queryKey: ["/api/plans", selectedPlanIds[1]],
    queryFn: () => fetch(`/api/plans/${selectedPlanIds[1]}`).then(res => res.json()),
    enabled: !!selectedPlanIds[1] && selectedPlanIds[1] !== comparison?.recommendedPlans[1]?.id,
  });

  const { data: selectedPlan3 } = useQuery<Plan>({
    queryKey: ["/api/plans", selectedPlanIds[2]],
    queryFn: () => fetch(`/api/plans/${selectedPlanIds[2]}`).then(res => res.json()),
    enabled: !!selectedPlanIds[2] && selectedPlanIds[2] !== comparison?.recommendedPlans[2]?.id,
  });

  // Initialize selected plans from comparison data (only once)
  useEffect(() => {
    if (comparison?.recommendedPlans && !didInitialize.current) {
      setSelectedPlanIds([
        comparison.recommendedPlans[0]?.id || null,
        comparison.recommendedPlans[1]?.id || null,
        comparison.recommendedPlans[2]?.id || null,
      ]);
      setSelectedCarrierIds([
        comparison.recommendedPlans[0]?.carrierId || null,
        comparison.recommendedPlans[1]?.carrierId || null,
        comparison.recommendedPlans[2]?.carrierId || null,
      ]);
      didInitialize.current = true;
    }
  }, [comparison]);

  const formatCurrency = (value: string | number | null | undefined): string => {
    if (value == null || value === "") return "N/A";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  // Handle plan selection change
  const handlePlanChange = (index: number, planId: string) => {
    const newPlanIds = [...selectedPlanIds] as [number | null, number | null, number | null];
    newPlanIds[index] = planId ? parseInt(planId) : null;
    setSelectedPlanIds(newPlanIds);
    
    // Update carrier based on selected plan
    if (planId) {
      const plan = availablePlans.find(p => p.id === parseInt(planId));
      if (plan) {
        const newCarrierIds = [...selectedCarrierIds] as [number | null, number | null, number | null];
        newCarrierIds[index] = plan.carrierId;
        setSelectedCarrierIds(newCarrierIds);
      }
    }
  };

  // Handle carrier selection change
  const handleCarrierChange = (index: number, carrierId: string) => {
    const newCarrierIds = [...selectedCarrierIds] as [number | null, number | null, number | null];
    newCarrierIds[index] = carrierId ? parseInt(carrierId) : null;
    setSelectedCarrierIds(newCarrierIds);
    
    // Reset plan selection when carrier changes
    const newPlanIds = [...selectedPlanIds] as [number | null, number | null, number | null];
    newPlanIds[index] = null;
    setSelectedPlanIds(newPlanIds);
  };

  // Convert Plan to comparison format
  const convertPlanToComparisonFormat = (plan: Plan, carrier: Carrier | undefined) => ({
    id: plan.id,
    name: plan.name,
    carrierId: plan.carrierId,
    carrierName: carrier?.name || "Unknown",
    monthlyPremium: plan.monthlyPremium || "",
    annualDeductible: plan.annualDeductible || "",
    maxOutOfPocket: plan.maxOutOfPocket || "",
    primaryCareCopay: plan.primaryCareCopay || "",
    specialistCopay: plan.specialistCopay || "",
    prescriptionDeductible: plan.prescriptionDeductible || "",
    planType: plan.planType || "",
    isCSnp: plan.isCSnp || false,
    isDSnp: plan.isDSnp || false,
  });

  // Build display plans using selected plans or original recommendations
  const getDisplayPlans = () => {
    if (!comparison) return [];
    
    const displayPlans = [];
    
    for (let i = 0; i < 3; i++) {
      const selectedPlanData = i === 0 ? selectedPlan1 : i === 1 ? selectedPlan2 : selectedPlan3;
      const originalPlan = comparison.recommendedPlans[i];
      
      // If carrier is selected but plan is not chosen yet, show empty state
      if (selectedCarrierIds[i] && !selectedPlanIds[i]) {
        displayPlans.push(null);
      }
      // If user has selected a different plan than the original
      else if (selectedPlanData && selectedPlanIds[i] !== originalPlan?.id) {
        const carrier = carriers.find(c => c.id === selectedPlanData.carrierId);
        displayPlans.push(convertPlanToComparisonFormat(selectedPlanData, carrier));
      }
      // Use original recommendation
      else if (originalPlan) {
        displayPlans.push(originalPlan);
      }
      // No plan available
      else {
        displayPlans.push(null);
      }
    }
    
    return displayPlans;
  };

  if (clientLoading || comparisonLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading comparison...</p>
        </div>
      </div>
    );
  }

  if (!client || !comparison) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Comparison not found</h2>
          <Button className="mt-4" onClick={() => setLocation(`/clients/${id}`)}>
            Back to Client
          </Button>
        </div>
      </div>
    );
  }

  const displayedRecommendedPlans = getDisplayPlans();
  const allPlans = [comparison.currentPlan, ...displayedRecommendedPlans];

  const comparisonRows = [
    { label: "Plan Name", key: "name" },
    { label: "Carrier", key: "carrierName" },
    { label: "Plan Type", key: "planType" },
    { label: "Monthly Premium", key: "monthlyPremium", format: formatCurrency },
    { label: "Annual Deductible", key: "annualDeductible", format: formatCurrency },
    { label: "Max Out of Pocket", key: "maxOutOfPocket", format: formatCurrency },
    { label: "Primary Care Copay", key: "primaryCareCopay", format: formatCurrency },
    { label: "Specialist Copay", key: "specialistCopay", format: formatCurrency },
    { label: "Prescription Deductible", key: "prescriptionDeductible", format: formatCurrency },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/clients/${id}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Plan Comparison</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {client.fullName} • {client.county} County
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setChatOpen(true)}
              data-testid="button-open-chat"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat with AI
            </Button>
            <Button
              variant="default"
              data-testid="button-export-pdf"
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Comparison Table</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold bg-muted/50">Benefit</th>
                    <th className="text-left p-4 font-semibold bg-muted/30">
                      <div className="flex items-center gap-2">
                        Current Plan
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      </div>
                    </th>
                    {[0, 1, 2].map((idx) => {
                      const displayPlan = displayedRecommendedPlans[idx];
                      const originalPlan = comparison.recommendedPlans[idx];
                      const plansForCarrier = availablePlans.filter(p => p.carrierId === selectedCarrierIds[idx]);
                      
                      return (
                        <th key={idx} className="text-left p-4 font-semibold">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              Recommended {idx + 1}
                              {idx === 0 && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Best Match
                                </Badge>
                              )}
                            </div>
                            
                            {/* Carrier Selector */}
                            <Select
                              value={selectedCarrierIds[idx]?.toString() || ""}
                              onValueChange={(value) => handleCarrierChange(idx, value)}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-carrier-${idx}`}>
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
                            
                            {/* Plan Selector */}
                            <Select
                              value={selectedPlanIds[idx]?.toString() || ""}
                              onValueChange={(value) => handlePlanChange(idx, value)}
                              disabled={!selectedCarrierIds[idx]}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-plan-${idx}`}>
                                <SelectValue placeholder={selectedCarrierIds[idx] ? "Select plan" : "Select carrier first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {plansForCarrier.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id.toString()}>
                                    {plan.name} ({plan.planYear})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {displayPlan && (displayPlan.isCSnp || displayPlan.isDSnp) && (
                              <Badge variant="outline" className="text-xs w-fit">
                                {displayPlan.isCSnp ? "C-SNP" : "D-SNP"}
                              </Badge>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, rowIdx) => (
                    <tr key={row.key} className="border-b hover:bg-muted/20">
                      <td className="p-4 font-medium bg-muted/30">{row.label}</td>
                      {allPlans.map((plan, planIdx) => (
                        <td
                          key={`plan-${planIdx}-${row.key}`}
                          className={`p-4 ${planIdx === 0 ? 'bg-muted/10' : ''}`}
                          data-testid={`cell-${row.key}-${planIdx}`}
                        >
                          {plan && row.format
                            ? row.format(plan[row.key as keyof typeof plan] as any)
                            : plan ? (plan[row.key as keyof typeof plan] || "N/A") : "N/A"
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recommendation Reasons */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Why These Plans?</h3>
              {comparison.recommendedPlans.map((plan, idx) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {plan.name} (Score: {plan.score})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {plan.reasons.map((reason, reasonIdx) => (
                        <li key={reasonIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
