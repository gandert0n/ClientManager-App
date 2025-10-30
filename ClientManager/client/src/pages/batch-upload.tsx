import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface UploadResult {
  fileName: string;
  success: boolean;
  carrier?: string;
  plan?: string;
  documentType?: string;
  documentId?: number;
  confidence?: number;
  error?: string;
  extractedText?: string;
  suggestions?: {
    possibleCarriers?: Array<{name: string, score: number}>;
    possiblePlans?: Array<{name: string, carrier: string, score: number}>;
  };
}

interface BatchUploadResponse {
  total: number;
  successful: number;
  failed: number;
  results: UploadResult[];
}

export default function BatchUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<BatchUploadResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const res = await fetch('/api/ocr/batch-upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      return res.json() as Promise<BatchUploadResponse>;
    },
    onSuccess: (data) => {
      setUploadResults(data);
      setSelectedFiles([]);
      toast({
        title: "Upload Complete",
        description: `Processed ${data.total} files: ${data.successful} successful, ${data.failed} failed.`,
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

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setSelectedFiles(prev => [...prev, ...fileArray]);
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

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    uploadMutation.mutate(selectedFiles);
  };

  const clearResults = () => {
    setUploadResults(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Batch Document Upload</h1>
        <p className="text-muted-foreground mt-2">
          Upload multiple plan documents at once. Our system will automatically identify the carrier, plan, and document type using OCR.
        </p>
      </div>

      {!uploadResults ? (
        <div className="grid gap-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>Select Documents</CardTitle>
              <CardDescription>
                Upload PDFs or images of plan documents (SOB, EOC, ANOC, Provider Directory, Drug Formulary)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover-elevate'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF, JPG, PNG (max 10MB per file, up to 50 files)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  data-testid="input-file-upload"
                />
              </div>
            </CardContent>
          </Card>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Selected Files ({selectedFiles.length})</CardTitle>
                    <CardDescription>Review files before uploading</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFiles([])}
                      data-testid="button-clear-files"
                    >
                      Clear All
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      data-testid="button-upload"
                    >
                      {uploadMutation.isPending ? (
                        <>Processing...</>
                      ) : (
                        <>Upload {selectedFiles.length} Files</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/30"
                      data-testid={`file-item-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        data-testid={`button-remove-file-${index}`}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                {uploadMutation.isPending && (
                  <div className="mt-4">
                    <Progress value={undefined} className="w-full" />
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Processing files with OCR... This may take a few moments.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Results Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upload Results</CardTitle>
                <Button variant="outline" onClick={clearResults} data-testid="button-new-upload">
                  New Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-bold">{uploadResults.total}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <p className="text-sm text-green-700 dark:text-green-400">Successful</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {uploadResults.successful}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <p className="text-sm text-red-700 dark:text-red-400">Failed</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {uploadResults.failed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Results</CardTitle>
              <CardDescription>
                Review the processing results for each file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResults.results.map((result, index) => (
                    <TableRow key={index} data-testid={`result-row-${index}`}>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{result.fileName}</TableCell>
                      <TableCell>{result.carrier || "-"}</TableCell>
                      <TableCell>{result.plan || "-"}</TableCell>
                      <TableCell>
                        {result.documentType && result.documentType !== "UNKNOWN" ? (
                          <Badge variant="secondary">{result.documentType}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {result.confidence !== undefined ? (
                          <Badge
                            variant={result.confidence >= 70 ? "default" : "secondary"}
                          >
                            {result.confidence}%
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {!result.success && result.suggestions && (
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                View Suggestions
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="p-3 rounded-md bg-muted/50 text-sm space-y-2">
                                {result.error && (
                                  <p className="text-red-600 dark:text-red-400 font-medium">
                                    {result.error}
                                  </p>
                                )}
                                {result.suggestions.possibleCarriers && result.suggestions.possibleCarriers.length > 0 && (
                                  <div>
                                    <p className="font-medium mb-1">Possible Carriers:</p>
                                    <ul className="list-disc list-inside">
                                      {result.suggestions.possibleCarriers.slice(0, 3).map((c, i) => (
                                        <li key={i}>
                                          {c.name} ({Math.round(c.score * 100)}% match)
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {result.suggestions.possiblePlans && result.suggestions.possiblePlans.length > 0 && (
                                  <div>
                                    <p className="font-medium mb-1">Possible Plans:</p>
                                    <ul className="list-disc list-inside">
                                      {result.suggestions.possiblePlans.slice(0, 3).map((p, i) => (
                                        <li key={i}>
                                          {p.name} ({p.carrier}) - {Math.round(p.score * 100)}% match
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
