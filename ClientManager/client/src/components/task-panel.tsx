import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Calendar } from "lucide-react";
import type { Task } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TaskPanelProps {
  clientId: number;
  tasks: Task[];
}

export function TaskPanel({ clientId, tasks }: TaskPanelProps) {
  const { toast } = useToast();
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  const addTaskMutation = useMutation({
    mutationFn: async (data: { description: string; dueDate?: string }) => {
      return await apiRequest("POST", `/api/clients/${clientId}/tasks`, {
        description: data.description,
        dueDate: data.dueDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/incomplete"] });
      setNewTaskDescription("");
      setNewTaskDueDate("");
      toast({
        title: "Task added",
        description: "The task has been added successfully.",
      });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/incomplete"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/incomplete"] });
      toast({
        title: "Task deleted",
        description: "The task has been removed.",
      });
    },
  });

  const handleAddTask = () => {
    if (newTaskDescription.trim()) {
      addTaskMutation.mutate({
        description: newTaskDescription,
        dueDate: newTaskDueDate,
      });
    }
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Next Steps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Task */}
        <div className="space-y-3">
          <Input
            placeholder="Add a new task..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddTask();
              }
            }}
            data-testid="input-new-task"
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="flex-1"
              data-testid="input-task-due-date"
            />
            <Button
              onClick={handleAddTask}
              disabled={!newTaskDescription.trim() || addTaskMutation.isPending}
              size="icon"
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Active Tasks */}
        <div className="space-y-2">
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active tasks. Add one above.
            </p>
          ) : (
            activeTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-md border hover-elevate"
                data-testid={`task-item-${task.id}`}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                  className="mt-0.5"
                  data-testid={`checkbox-task-${task.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm break-words">{task.description}</p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.dueDate), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                  data-testid={`button-delete-task-${task.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Completed
            </p>
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-md border opacity-60"
                data-testid={`completed-task-${task.id}`}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTaskMutation.mutate(task.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through break-words">{task.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
