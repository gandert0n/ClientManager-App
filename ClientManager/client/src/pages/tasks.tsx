import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, Search, Calendar, User, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Task, Patient } from "@shared/schema";

type TaskWithPatient = Task & { patient: Patient };

export default function Tasks() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tasks = [], isLoading } = useQuery<TaskWithPatient[]>({
    queryKey: ["/api/tasks/incomplete"],
    queryFn: async () => {
      const res = await fetch("/api/tasks/incomplete");
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, patientId }: { taskId: number; patientId: number }) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}/toggle`, {});
    },
    onSuccess: (_, { patientId }) => {
      // Always invalidate both caches to ensure synchronization
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/incomplete"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({
        title: "Task updated",
        description: "The task status has been updated.",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async ({ taskId, patientId }: { taskId: number; patientId: number }) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`, {});
    },
    onSuccess: (_, { patientId }) => {
      // Invalidate both master list and patient-specific cache
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/incomplete"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId] });
      toast({
        title: "Task deleted",
        description: "The task has been removed.",
      });
    },
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.patient.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group tasks by patient
  const tasksByPatient = filteredTasks.reduce((acc, task) => {
    const patientId = task.patient.id;
    if (!acc[patientId]) {
      acc[patientId] = {
        patient: task.patient,
        tasks: [],
      };
    }
    acc[patientId].tasks.push(task);
    return acc;
  }, {} as Record<number, { patient: Patient; tasks: TaskWithPatient[] }>);

  const patientGroups = Object.values(tasksByPatient);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Task Management</h1>
          <p className="text-muted-foreground">
            All clients with incomplete tasks
          </p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-tasks"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Incomplete Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tasks">{tasks.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clients with Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-clients-with-tasks">{patientGroups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-tasks">
                {tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks grouped by patient */}
        {patientGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No incomplete tasks at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {patientGroups.map(({ patient, tasks: patientTasks }) => (
              <Card key={patient.id} data-testid={`card-patient-tasks-${patient.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-lg">
                          <button
                            onClick={() => setLocation(`/patients/${patient.id}`)}
                            className="hover:underline text-left"
                            data-testid={`link-patient-${patient.id}`}
                          >
                            {patient.fullName}
                          </button>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {patientTasks.length} incomplete {patientTasks.length === 1 ? 'task' : 'tasks'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/patients/${patient.id}`)}
                      data-testid={`button-view-patient-${patient.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patientTasks.map((task) => {
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-3 rounded-md bg-muted/30 hover-elevate"
                          data-testid={`task-${task.id}`}
                        >
                          <button
                            onClick={() => toggleTaskMutation.mutate({ taskId: task.id, patientId: task.patient.id })}
                            className="flex-shrink-0"
                            data-testid={`button-toggle-task-${task.id}`}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" data-testid={`text-task-description-${task.id}`}>
                              {task.description}
                            </p>
                            {task.dueDate && (
                              <div className="flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span
                                  className={`text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
                                  data-testid={`text-task-due-${task.id}`}
                                >
                                  Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                                  {isOverdue && " (Overdue)"}
                                </span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTaskMutation.mutate({ taskId: task.id, patientId: task.patient.id })}
                            disabled={deleteTaskMutation.isPending}
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
