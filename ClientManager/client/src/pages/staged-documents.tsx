import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Trash2,
  Save,
  CheckCircle2,
  Eye,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import type { StagedDocument, Carrier, Plan } from "@shared/schema";

interface StagedDocumentWithRelations extends StagedDocument {
  carrier?: Carrier | null;
  plan?: Plan | null;
}

const DOCUMENT_TYPES = [
  { value: "SOB", label: "Summary of Benefits" },
  { value: "EOC", label: "Evidence of Coverage" },
  { value: "ANOC", label: "Annual Notice of Change" },
  { value: "PROVIDER_LIST", label: "Provider Directory" },
  { value: "DRUG_FORMULARY", label: "Drug Formulary" },
];

export default function StagedDocuments() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [editingDoc, setEditingDoc] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    carrierId: "",
    planId: "",
    documentType: "",
  });
  const [previewDoc, setPreviewDoc] = useState<StagedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch staged documents
  const { data: stagedDocs = [], refetch } = useQuery<StagedDocument[]>({
    queryKey: ["/api/staged-documents"],
  });

  // Fetch carriers for dropdown
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });

  // Fetch plans for dropdown
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));

      const res = await fetch("/api/staged-documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      refetch();
      setSelectedFiles([]);
      toast({
        title: "Upload Complete",
        description: "Files uploaded to staging area successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<typeof editForm>;
    }) => {
      const res = await fetch(`/api/staged-documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Update failed");
      }

      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditingDoc(null);
      toast({
        title: "Success",
        description: "Document metadata updated successfully.",
      });
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/staged-documents/${id}/assign`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Assignment failed");
      }

      return res.json();
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Success",
        description: "Document assigned to plan successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/staged-documents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success",
        description: "Document deleted from staging.",
      });
    },
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...fileArray]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    uploadMutation.mutate(selectedFiles);
  };

  const startEdit = (doc: StagedDocument) => {
    setEditingDoc(doc.id);
    setEditForm({
      displayName: doc.displayName || "",
      carrierId: doc.carrierId?.toString() || "",
      planId: doc.planId?.toString() || "",
      documentType: doc.documentType || "",
    });
  };

  const saveEdit = (id: number) => {
    updateMutation.mutate({
      id,
      data: {
        displayName: editForm.displayName || undefined,
        carrierId: editForm.carrierId || undefined,
        planId: editForm.planId || undefined,
        documentType: editForm.documentType || undefined,
      },
    });
  };

  const cancelEdit = () => {
    setEditingDoc(null);
    setEditForm({
      displayName: "",
      carrierId: "",
      planId: "",
      documentType: "",
    });
  };

  const handleAssign = (doc: StagedDocument) => {
    if (!doc.planId || !doc.documentType) {
      toast({
        title: "Cannot Assign",
        description: "Plan and Document Type must be set before assignment.",
        variant: "destructive",
      });
      return;
    }
    assignMutation.mutate(doc.id);
  };

  const canAssign = (doc: StagedDocument) => {
    return doc.planId && doc.documentType;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Staged Documents
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload, preview, and assign documents to plans
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="dropzone-upload"
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supports PDF, JPG, PNG (max 200MB per file)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-select-files"
            >
              Select Files
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Selected Files ({selectedFiles.length})
              </p>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSelectedFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
                data-testid="button-upload"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload to Staging"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staged Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staged Documents ({stagedDocs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {stagedDocs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staged documents. Upload files to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Doc Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagedDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-mono">
                          {doc.originalName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingDoc === doc.id ? (
                        <Input
                          value={editForm.displayName}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              displayName: e.target.value,
                            })
                          }
                          placeholder="Optional display name"
                          className="w-48"
                        />
                      ) : (
                        <span className="text-sm">
                          {doc.displayName || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingDoc === doc.id ? (
                        <Select
                          value={editForm.carrierId}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, carrierId: value, planId: "" })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select carrier" />
                          </SelectTrigger>
                          <SelectContent>
                            {carriers.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {carriers.find((c) => c.id === doc.carrierId)?.name || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingDoc === doc.id ? (
                        <Select
                          value={editForm.planId}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, planId: value })
                          }
                          disabled={!editForm.carrierId}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans
                              .filter(
                                (p) =>
                                  p.carrierId.toString() === editForm.carrierId
                              )
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {plans.find((p) => p.id === doc.planId)?.name || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingDoc === doc.id ? (
                        <Select
                          value={editForm.documentType}
                          onValueChange={(value) =>
                            setEditForm({ ...editForm, documentType: value })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {DOCUMENT_TYPES.find((t) => t.value === doc.documentType)
                            ?.label || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canAssign(doc) ? (
                        <Badge variant="default">Ready</Badge>
                      ) : (
                        <Badge variant="secondary">Incomplete</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {editingDoc === doc.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => saveEdit(doc.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-save-${doc.id}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDoc(doc)}
                              data-testid={`button-preview-${doc.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(doc)}
                              data-testid={`button-edit-${doc.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAssign(doc)}
                              disabled={
                                !canAssign(doc) || assignMutation.isPending
                              }
                              data-testid={`button-assign-${doc.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(doc.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>
              {previewDoc?.originalName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">File Size</Label>
                <p>
                  {previewDoc?.fileSize
                    ? `${(previewDoc.fileSize / 1024 / 1024).toFixed(2)} MB`
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p>{previewDoc?.mimeType || "N/A"}</p>
              </div>
            </div>
            {previewDoc?.extractedText && (
              <div>
                <Label className="text-muted-foreground">Extracted Text (OCR)</Label>
                <div className="mt-2 p-4 bg-muted rounded-md max-h-96 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {previewDoc.extractedText}
                  </pre>
                </div>
              </div>
            )}
            {!previewDoc?.extractedText && (
              <p className="text-sm text-muted-foreground">
                No extracted text available.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
