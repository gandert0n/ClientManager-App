import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import NewIntake from "@/pages/new-intake";
import Records from "@/pages/records";
import ClientDetail from "@/pages/patient-detail";
import Plans from "@/pages/plans";
import Tasks from "@/pages/tasks";
import MasterManagement from "@/pages/master-management";
import PlanComparison from "@/pages/plan-comparison";
import BatchUpload from "@/pages/batch-upload";
import StagedDocuments from "@/pages/staged-documents";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-intake" component={NewIntake} />
      <Route path="/records" component={Records} />
      <Route path="/plans" component={Plans} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/batch-upload" component={BatchUpload} />
      <Route path="/staged-documents" component={StagedDocuments} />
      <Route path="/master-management" component={MasterManagement} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/clients/:id/comparison/:comparisonId" component={PlanComparison} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
