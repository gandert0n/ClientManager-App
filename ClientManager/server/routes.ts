import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertTaskSchema, insertCarrierSchema, insertPlanSchema, insertPlanDocumentSchema, insertStagedDocumentSchema, insertStateSchema, REQUIRED_DOCUMENT_TYPES } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { compareTwoStrings, findBestMatch } from "string-similarity";
import Tesseract from "tesseract.js";
import { PDFParse } from "pdf-parse";

// Ensure upload directory exists
const uploadDir = "/tmp/uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads with proper file extension preservation
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Preserve the file extension from original filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all clients
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Get client by ID with relations
  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Create new client with medications and doctors
  app.post("/api/clients", async (req, res) => {
    try {
      const { medications: meds, doctors: docs, ...clientData } = req.body;
      
      // Validate client data
      const validatedData = insertClientSchema.parse(clientData);
      
      // Create client
      const client = await storage.createClient(validatedData);

      // Add medications if provided
      if (meds && Array.isArray(meds) && meds.length > 0) {
        for (const med of meds) {
          await storage.createMedication({
            clientId: client.id,
            drugName: med.drugName,
            dosage: med.dosage || null,
          });
        }
      }

      // Add doctors if provided
      if (docs && Array.isArray(docs) && docs.length > 0) {
        for (const doc of docs) {
          // Handle both string format (new) and object format (legacy)
          const doctorName = typeof doc === 'string' ? doc : doc.name;
          await storage.createDoctor({
            clientId: client.id,
            name: doctorName,
            specialty: null,
            phoneNumber: null,
          });
        }
      }

      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // Update client
  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const { medications: meds, doctors: docs, ...clientData } = req.body;

      // Validate client data
      const validatedData = insertClientSchema.partial().parse(clientData);

      // Update client
      const client = await storage.updateClient(id, validatedData);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Update medications if provided
      if (meds && Array.isArray(meds)) {
        // Delete existing medications
        await storage.deleteMedicationsByClient(id);

        // Add new medications
        for (const med of meds) {
          await storage.createMedication({
            clientId: id,
            drugName: med.drugName,
            dosage: med.dosage || null,
          });
        }
      }

      // Update doctors if provided
      if (docs && Array.isArray(docs)) {
        // Delete existing doctors
        await storage.deleteDoctorsByClient(id);

        // Add new doctors
        for (const doc of docs) {
          // Handle both string format (new) and object format (legacy)
          const doctorName = typeof doc === 'string' ? doc : doc.name;
          await storage.createDoctor({
            clientId: id,
            name: doctorName,
            specialty: null,
            phoneNumber: null,
          });
        }
      }

      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Create task for client
  app.post("/api/clients/:id/tasks", async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const validatedData = insertTaskSchema.parse({
        ...req.body,
        clientId,
        completed: false,
      });

      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Toggle task completion
  app.patch("/api/tasks/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      const task = await storage.toggleTask(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error("Error toggling task:", error);
      res.status(500).json({ error: "Failed to toggle task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      await storage.deleteTask(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Get all incomplete tasks (master list)
  app.get("/api/tasks/incomplete", async (req, res) => {
    try {
      const tasksWithClients = await storage.getAllIncompleteTasks();
      res.json(tasksWithClients);
    } catch (error) {
      console.error("Error fetching incomplete tasks:", error);
      res.status(500).json({ error: "Failed to fetch incomplete tasks" });
    }
  });

  // ========== RECOMMENDATIONS ROUTES ==========

  // Get recommended plans for a client
  app.get("/api/clients/:id/recommendations", async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const recommendations = await storage.getRecommendedPlans(clientId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  // Get client completion status
  app.get("/api/clients/:id/completion", async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const completionStatus = await storage.getClientCompletionStatus(clientId);
      res.json(completionStatus);
    } catch (error) {
      console.error("Error fetching completion status:", error);
      res.status(500).json({ error: "Failed to fetch completion status" });
    }
  });

  // Batch get completion status for multiple clients
  app.get("/api/clients-completion", async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      const completionData = await Promise.all(
        clients.map(async (client) => ({
          clientId: client.id,
          completion: await storage.getClientCompletionStatus(client.id)
        }))
      );
      res.json(completionData);
    } catch (error) {
      console.error("Error fetching batch completion status:", error);
      res.status(500).json({ error: "Failed to fetch completion status" });
    }
  });

  // CSV Import endpoint
  app.post("/api/clients/import-csv", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Read and parse CSV file
      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        fs.unlinkSync(req.file.path); // Clean up
        return res.status(400).json({ error: "CSV file is empty or invalid" });
      }

      // Parse header row
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const imported: any[] = [];
      const errors: any[] = [];

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        try {
          // Map CSV columns to client schema (flexible mapping)
          const clientData = {
            fullName: row['full_name'] || row['name'] || row['fullname'] || '',
            birthdate: row['birthdate'] || row['dob'] || row['date_of_birth'] || '',
            phoneNumber: row['phone_number'] || row['phone'] || row['phonenumber'] || '',
            medicareNumber: row['medicare_number'] || row['medicare'] || row['medicarenumber'] || '',
            socialSecurityNumber: row['social_security_number'] || row['ssn'] || row['socialsecuritynumber'] || '',
            address: row['address'] || '',
            city: row['city'] || '',
            state: row['state'] || '',
            zipCode: row['zip_code'] || row['zip'] || row['zipcode'] || '',
            county: row['county'] || null,
            goals: row['goals'] || null,
            spokeWithThisAep: row['spoke_with_this_aep'] === 'true' || row['spoke_with_this_aep'] === '1' || false,
            continueWithCurrentPlan: row['continue_with_current_plan'] === 'true' || row['continue_with_current_plan'] === '1' || false,
          };

          // Validate required fields
          if (!clientData.fullName || !clientData.birthdate || !clientData.phoneNumber || 
              !clientData.medicareNumber || !clientData.socialSecurityNumber) {
            errors.push({
              row: i + 1,
              data: row,
              error: "Missing required fields (name, birthdate, phone, medicare number, or SSN)"
            });
            continue;
          }

          // Create client
          const client = await storage.createClient(clientData as any);
          imported.push({ row: i + 1, clientId: client.id, name: client.fullName });

        } catch (error) {
          errors.push({
            row: i + 1,
            data: row,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        imported: imported.length,
        errors: errors.length,
        details: {
          imported,
          errors
        }
      });

    } catch (error) {
      console.error("CSV import error:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  // Search drugs using FDA OpenFDA API
  app.get("/api/drugs/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      // Call FDA OpenFDA API
      const searchQuery = encodeURIComponent(query);
      const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${searchQuery}*+openfda.generic_name:${searchQuery}*&limit=6`;

      const response = await fetch(url);
      
      if (!response.ok) {
        // Return empty array if no results or error
        return res.json([]);
      }

      const data = await response.json();
      
      // Extract drug names and dosages
      const suggestions = data.results?.slice(0, 6).map((result: any) => {
        const brandName = result.openfda?.brand_name?.[0];
        const genericName = result.openfda?.generic_name?.[0];
        const dosageForm = result.dosage_and_administration?.[0];
        
        // Extract dosage info from the text if available
        let dosage = "";
        if (dosageForm) {
          // Simple extraction - get first sentence or first 100 chars
          const sentences = dosageForm.split(/[.!?]/);
          dosage = sentences[0]?.substring(0, 100).trim();
        }

        return {
          name: brandName || genericName || "Unknown",
          dosage: dosage || undefined,
        };
      }).filter((item: any) => item.name !== "Unknown") || [];

      res.json(suggestions);
    } catch (error) {
      console.error("Error searching drugs:", error);
      // Return empty array on error to not break the UI
      res.json([]);
    }
  });

  // ========== CARRIERS ROUTES ==========
  
  // Get all carriers
  app.get("/api/carriers", async (req, res) => {
    try {
      const carriers = await storage.getAllCarriers();
      res.json(carriers);
    } catch (error) {
      console.error("Error fetching carriers:", error);
      res.status(500).json({ error: "Failed to fetch carriers" });
    }
  });

  // Create carrier
  app.post("/api/carriers", async (req, res) => {
    try {
      const validatedData = insertCarrierSchema.parse(req.body);
      const carrier = await storage.createCarrier(validatedData);
      res.status(201).json(carrier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating carrier:", error);
      res.status(500).json({ error: "Failed to create carrier" });
    }
  });

  // Delete carrier
  app.delete("/api/carriers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid carrier ID" });
      }

      await storage.deleteCarrier(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting carrier:", error);
      res.status(500).json({ error: "Failed to delete carrier" });
    }
  });

  // ========== STATES ROUTES ==========

  // Get all states
  app.get("/api/states", async (req, res) => {
    try {
      const states = await storage.getAllStates();
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ error: "Failed to fetch states" });
    }
  });

  // Create state
  app.post("/api/states", async (req, res) => {
    try {
      const validatedData = insertStateSchema.parse(req.body);
      const state = await storage.createState(validatedData);
      res.status(201).json(state);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating state:", error);
      res.status(500).json({ error: "Failed to create state" });
    }
  });

  // Delete state
  app.delete("/api/states/:code", async (req, res) => {
    try {
      const code = req.params.code;
      await storage.deleteState(code);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting state:", error);
      res.status(500).json({ error: "Failed to delete state" });
    }
  });

  // ========== PLANS ROUTES ==========

  // Get all plans (with optional filters)
  app.get("/api/plans", async (req, res) => {
    try {
      const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
      const stateCode = req.query.stateCode ? String(req.query.stateCode) : undefined;
      
      let plans;
      if (stateCode) {
        plans = await storage.getPlansByState(stateCode);
      } else if (carrierId) {
        plans = await storage.getPlansByCarrier(carrierId);
      } else {
        plans = await storage.getAllPlans();
      }
      
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  // Get plan by ID with documents
  app.get("/api/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const plan = await storage.getPlan(id);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      res.json(plan);
    } catch (error) {
      console.error("Error fetching plan:", error);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // Create plan
  app.post("/api/plans", async (req, res) => {
    try {
      const validatedData = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating plan:", error);
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  // Update plan
  app.patch("/api/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const validatedData = insertPlanSchema.partial().parse(req.body);
      const plan = await storage.updatePlan(id, validatedData);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      res.json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating plan:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  // Delete plan
  app.delete("/api/plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      await storage.deletePlan(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting plan:", error);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  });

  // Apply extracted benefits to a plan (from OCR)
  app.patch("/api/plans/:id/apply-benefits", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const { extractedBenefits } = req.body;
      if (!extractedBenefits || typeof extractedBenefits !== 'object') {
        return res.status(400).json({ error: "No benefits data provided" });
      }

      // Only update fields that were successfully extracted
      const updates: any = {};
      if (extractedBenefits.monthlyPremium) updates.monthlyPremium = extractedBenefits.monthlyPremium;
      if (extractedBenefits.annualDeductible) updates.annualDeductible = extractedBenefits.annualDeductible;
      if (extractedBenefits.maxOutOfPocket) updates.maxOutOfPocket = extractedBenefits.maxOutOfPocket;
      if (extractedBenefits.primaryCareCopay) updates.primaryCareCopay = extractedBenefits.primaryCareCopay;
      if (extractedBenefits.specialistCopay) updates.specialistCopay = extractedBenefits.specialistCopay;
      if (extractedBenefits.prescriptionDeductible) updates.prescriptionDeductible = extractedBenefits.prescriptionDeductible;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid benefits to apply" });
      }

      const plan = await storage.updatePlan(id, updates);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      res.json({ 
        message: "Benefits applied successfully", 
        plan,
        appliedFields: Object.keys(updates)
      });
    } catch (error) {
      console.error("Error applying benefits:", error);
      res.status(500).json({ error: "Failed to apply benefits" });
    }
  });

  // Get missing documents for a plan
  app.get("/api/plans/:id/missing-documents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const missingDocs = await storage.getMissingDocuments(id);
      res.json(missingDocs);
    } catch (error) {
      console.error("Error fetching missing documents:", error);
      res.status(500).json({ error: "Failed to fetch missing documents" });
    }
  });

  // ========== PLAN DOCUMENTS ROUTES ==========

  // Get documents for a plan
  app.get("/api/plans/:id/documents", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const documents = await storage.getDocumentsByPlan(id);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching plan documents:", error);
      res.status(500).json({ error: "Failed to fetch plan documents" });
    }
  });

  // Upload plan document
  app.post("/api/plans/:id/documents", upload.single('file'), async (req, res) => {
    let movedFilePath: string | null = null;
    
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentType } = req.body;
      
      // Validate documentType against allowed types (CRITICAL: prevents path traversal)
      if (!documentType || !REQUIRED_DOCUMENT_TYPES.includes(documentType)) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: `Invalid document type. Must be one of: ${REQUIRED_DOCUMENT_TYPES.join(', ')}` 
        });
      }

      // Create documents directory if it doesn't exist
      const docsDir = path.join(process.cwd(), 'uploaded_documents');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // Sanitize filename - only use safe characters (CRITICAL: prevents path traversal)
      const safeFileName = `${documentType}_${planId}_${Date.now()}${path.extname(req.file.originalname).replace(/[^.a-zA-Z0-9]/g, '')}`;
      const filePath = path.join(docsDir, safeFileName);
      
      // Move file to permanent location (use copy+unlink to support cross-device moves)
      fs.copyFileSync(req.file.path, filePath);
      fs.unlinkSync(req.file.path);
      movedFilePath = filePath;

      // Save document metadata to database
      const document = await storage.createPlanDocument({
        planId,
        documentType,
        fileName: req.file.originalname,
        filePath: `/api/documents/${safeFileName}`,
        fileSize: req.file.size,
      });

      res.status(201).json(document);
    } catch (error) {
      // Clean up files on error - both original temp file and moved file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (movedFilePath && fs.existsSync(movedFilePath)) {
        fs.unlinkSync(movedFilePath);
      }
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Serve uploaded documents
  app.get("/api/documents/:filename", (req, res) => {
    try {
      // Sanitize filename to prevent directory traversal (CRITICAL)
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(process.cwd(), 'uploaded_documents', safeFilename);
      
      // Ensure the resolved path is still within uploaded_documents directory
      const docsDir = path.join(process.cwd(), 'uploaded_documents');
      if (!filePath.startsWith(docsDir)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Set proper content type for PDFs
      if (safeFilename.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
      
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving document:", error);
      res.status(500).json({ error: "Failed to serve document" });
    }
  });

  // Delete plan document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      // Get document to delete file
      const docs = await storage.getDocumentsByPlan(0); // This is a workaround; ideally we'd have a getDocumentById
      const doc = docs.find(d => d.id === id);
      
      if (doc) {
        const filePath = path.join(process.cwd(), 'uploaded_documents', path.basename(doc.filePath));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await storage.deletePlanDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ========== STAGED DOCUMENTS ROUTES ==========

  // Get all staged documents
  app.get("/api/staged-documents", async (req, res) => {
    try {
      const staged = await storage.getAllStagedDocuments();
      res.json(staged);
    } catch (error) {
      console.error("Error fetching staged documents:", error);
      res.status(500).json({ error: "Failed to fetch staged documents" });
    }
  });

  // Get a single staged document
  app.get("/api/staged-documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const doc = await storage.getStagedDocument(id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(doc);
    } catch (error) {
      console.error("Error fetching staged document:", error);
      res.status(500).json({ error: "Failed to fetch staged document" });
    }
  });

  // Upload files to staging area
  app.post("/api/staged-documents/upload", upload.array('files', 50), async (req, res) => {
    const uploadedFiles: string[] = [];
    
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Validate MIME types
      const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      for (const file of files) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          files.forEach(f => fs.unlinkSync(f.path));
          return res.status(400).json({ 
            error: `Invalid file type: ${file.originalname}. Only PDF, JPG, and PNG files are allowed.` 
          });
        }
      }

      const results = [];

      // Process each file
      for (const file of files) {
        uploadedFiles.push(file.path);
        
        try {
          // Extract text from document
          let extractedText = '';
          try {
            extractedText = await extractTextFromDocument(file.path);
          } catch (extractError) {
            console.warn(`Could not extract text from ${file.originalname}:`, extractError);
            // Continue anyway - text extraction is optional
          }

          // Create staged document entry
          const stagedDoc = await storage.createStagedDocument({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: `/api/documents/${file.filename}`,
            fileSize: file.size,
            mimeType: file.mimetype,
            extractedText: extractedText || null,
            displayName: null,
            carrierId: null,
            planId: null,
            documentType: null,
          });

          results.push({
            fileName: file.originalname,
            success: true,
            stagedDocument: stagedDoc,
          });
        } catch (error) {
          results.push({
            fileName: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : "Failed to stage document"
          });
        }
      }

      res.json({ results });
    } catch (error) {
      // Clean up uploaded files on error
      uploadedFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      console.error("Error uploading to staging:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  // Update staged document metadata
  app.patch("/api/staged-documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const { displayName, carrierId, planId, documentType } = req.body;
      
      const updated = await storage.updateStagedDocument(id, {
        displayName,
        carrierId: carrierId ? parseInt(carrierId) : null,
        planId: planId ? parseInt(planId) : null,
        documentType,
      });

      if (!updated) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating staged document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Assign staged document to plan (moves from staging to plan documents)
  app.post("/api/staged-documents/:id/assign", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const planDoc = await storage.assignStagedDocumentToPlan(id);
      if (!planDoc) {
        return res.status(400).json({ error: "Cannot assign: missing plan ID or document type" });
      }

      res.json(planDoc);
    } catch (error) {
      console.error("Error assigning staged document:", error);
      res.status(500).json({ error: "Failed to assign document" });
    }
  });

  // Delete staged document
  app.delete("/api/staged-documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      // Get document to delete file
      const doc = await storage.getStagedDocument(id);
      if (doc) {
        const fileName = path.basename(doc.filePath);
        const filePath = path.join(uploadDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await storage.deleteStagedDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting staged document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ========== OCR ROUTES ==========

  // Batch OCR document processing for plan documents
  app.post("/api/ocr/batch-upload", upload.array('files', 50), async (req, res) => {
    const uploadedFiles: string[] = [];
    
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Validate MIME types (server-side check)
      const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      for (const file of files) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          // Clean up all files
          files.forEach(f => fs.unlinkSync(f.path));
          return res.status(400).json({ 
            error: `Invalid file type: ${file.originalname}. Only PDF, JPG, and PNG files are allowed.` 
          });
        }
      }

      // No API key needed for Tesseract - it runs locally

      // Get all carriers and plans for matching
      const carriers = await storage.getAllCarriers();
      const plans = await storage.getAllPlans();

      const results = [];

      // Process each file
      for (const file of files) {
        uploadedFiles.push(file.path);
        
        try {
          // Extract text from PDF or image
          let text: string;
          try {
            text = await extractTextFromDocument(file.path);
          } catch (extractError) {
            // Handle extraction errors (e.g., scanned PDFs)
            results.push({
              fileName: file.originalname,
              success: false,
              error: extractError instanceof Error ? extractError.message : "Failed to extract text from document"
            });
            continue;
          }

          if (!text || text.trim().length === 0) {
            results.push({
              fileName: file.originalname,
              success: false,
              error: "No text found in document"
            });
            continue;
          }

          // Extract carrier, plan, and document type from OCR text
          const extracted = parsePlanDocumentText(text, carriers, plans);

          // Log detection results for debugging
          console.log(`OCR Detection for ${file.originalname}:`, {
            documentType: extracted.documentType,
            detectedPlanIds: extracted.detectedPlanIds,
            carrier: extracted.carrier?.name || 'None',
            plan: extracted.plan?.name || 'None',
            confidence: extracted.confidence,
            topCarrierMatches: extracted.carrierMatches?.slice(0, 3),
            topPlanMatches: extracted.planMatches?.slice(0, 3)
          });

          // CRITICAL: Validate carrier/plan match before saving
          if (!extracted.carrier || !extracted.plan || 
              extracted.plan.carrierId !== extracted.carrier.id ||
              extracted.confidence < 40) {
            results.push({
              fileName: file.originalname,
              success: false,
              error: extracted.carrier && extracted.plan && extracted.plan.carrierId !== extracted.carrier.id
                ? "Carrier and plan mismatch - cannot auto-assign"
                : extracted.confidence < 40
                ? "Low confidence match - manual review required"
                : "Could not identify carrier or plan",
              extractedText: text.substring(0, 500), // First 500 chars for review
              suggestions: {
                possibleCarriers: extracted.carrierMatches?.slice(0, 3),
                possiblePlans: extracted.planMatches?.slice(0, 3)
              },
              extractedBenefits: extracted.extractedBenefits
            });
            continue;
          }

          // Create documents directory if it doesn't exist
          const docsDir = path.join(process.cwd(), 'uploaded_documents');
          if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
          }

          // Move file to documents directory with safe naming
          const timestamp = Date.now();
          const fileExtension = path.extname(file.originalname);
          const safeDocType = extracted.documentType.replace(/[^a-zA-Z0-9]/g, '_');
          const newFileName = `${safeDocType}_${extracted.plan.id}_${timestamp}${fileExtension}`;
          const newPath = path.join(docsDir, newFileName);
          
          fs.copyFileSync(file.path, newPath);

          // Create plan document record
          const planDocument = await storage.createPlanDocument({
            planId: extracted.plan.id,
            documentType: extracted.documentType,
            fileName: file.originalname,
            filePath: newFileName,
            fileSize: file.size
          });

          results.push({
            fileName: file.originalname,
            success: true,
            carrier: extracted.carrier.name,
            plan: extracted.plan.name,
            planId: extracted.plan.id,
            documentType: extracted.documentType,
            documentId: planDocument.id,
            confidence: extracted.confidence,
            extractedBenefits: extracted.extractedBenefits
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({
            fileName: file.originalname,
            success: false,
            error: fileError instanceof Error ? fileError.message : "Processing failed"
          });
        }
      }

      // Clean up all temporary files
      uploadedFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      // Return results summary
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results
      });

    } catch (error) {
      // Clean up all files on error
      uploadedFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      console.error("Error in batch OCR upload:", error);
      res.status(500).json({ error: "Failed to process batch upload" });
    }
  });

  // OCR document upload and processing
  app.post("/api/ocr/process", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Extract text from PDF or image
      let text: string;
      try {
        text = await extractTextFromDocument(req.file.path);
      } catch (extractError) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        return res.json({ 
          success: false, 
          error: extractError instanceof Error ? extractError.message : "Failed to extract text from document"
        });
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      if (!text || text.trim().length === 0) {
        return res.json({ 
          success: false, 
          error: "No text found in document" 
        });
      }

      // Parse extracted text to find patient information
      const extractedData = parseOCRText(text);

      res.json({
        success: true,
        extractedText: text,
        parsedData: extractedData
      });
    } catch (error) {
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Error processing OCR:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // ========== PLAN COMPARISON ENDPOINTS ==========

  // Check if client has required data for comparison
  app.get("/api/clients/:id/readiness", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const missing: string[] = [];
      const warnings: string[] = [];

      // Check required data
      if (!client.county) {
        missing.push("County - Required to find available plans");
      }

      if (!client.currentPlanId) {
        missing.push("Current Plan - Required to show what they have now");
      } else {
        // Check if current plan has SOB document
        const currentPlan = await storage.getPlan(client.currentPlanId);
        if (currentPlan) {
          const documents = await storage.getPlanDocuments(currentPlan.id);
          const hasSob = documents.some(doc => doc.documentType === "SOB");
          if (!hasSob) {
            warnings.push("Current plan is missing SOB document - comparison will have limited details");
          }
        }
      }

      // Check optional but recommended data
      if (client.medications.length === 0) {
        warnings.push("No medications listed - drug coverage comparison won't be available");
      }

      if (client.doctors.length === 0) {
        warnings.push("No doctors listed - provider network comparison won't be available");
      }

      const isReady = missing.length === 0;

      res.json({
        ready: isReady,
        missing,
        warnings,
        clientData: {
          hasCounty: !!client.county,
          hasCurrentPlan: !!client.currentPlanId,
          medicationCount: client.medications.length,
          doctorCount: client.doctors.length,
        }
      });
    } catch (error) {
      console.error("Error checking readiness:", error);
      res.status(500).json({ error: "Failed to check readiness" });
    }
  });

  // Generate plan comparison
  app.post("/api/clients/:id/compare", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Validate required data
      if (!client.county) {
        return res.status(400).json({ error: "Client must have county specified" });
      }

      if (!client.currentPlanId) {
        return res.status(400).json({ error: "Client must have current plan specified" });
      }

      // Get current plan details
      const currentPlan = await storage.getPlan(client.currentPlanId);
      if (!currentPlan) {
        return res.status(404).json({ error: "Current plan not found" });
      }

      // Get all plans available in client's county and state
      const allPlans = await storage.getAllPlans();
      const availablePlans = allPlans.filter(plan => 
        plan.stateCode === client.state &&
        plan.counties &&
        plan.counties.includes(client.county!) &&
        plan.id !== currentPlan.id // Exclude current plan
      );

      // Score and rank plans
      const scoredPlans = availablePlans.map(plan => {
        let score = 100; // Start at 100
        const reasons: string[] = [];

        // Cost comparison (40 points max)
        const currentPremium = parseFloat(currentPlan.monthlyPremium || "0");
        const planPremium = parseFloat(plan.monthlyPremium || "0");
        const premiumSavings = currentPremium - planPremium;
        
        if (premiumSavings > 50) {
          score += 40;
          reasons.push(`Saves $${premiumSavings.toFixed(2)}/month on premium`);
        } else if (premiumSavings > 20) {
          score += 25;
          reasons.push(`Saves $${premiumSavings.toFixed(2)}/month on premium`);
        } else if (premiumSavings > 0) {
          score += 10;
          reasons.push(`Saves $${premiumSavings.toFixed(2)}/month on premium`);
        } else if (premiumSavings < -20) {
          score -= 20;
          reasons.push(`Higher premium by $${Math.abs(premiumSavings).toFixed(2)}/month`);
        }

        // MOOP comparison (30 points max)
        const currentMoop = parseFloat(currentPlan.maxOutOfPocket || "999999");
        const planMoop = parseFloat(plan.maxOutOfPocket || "999999");
        if (planMoop < currentMoop) {
          const moopSavings = currentMoop - planMoop;
          score += 30;
          reasons.push(`Lower max out-of-pocket by $${moopSavings.toFixed(0)}`);
        }

        // Copay comparison (20 points max)
        const currentPcpCopay = parseFloat(currentPlan.primaryCareCopay || "0");
        const planPcpCopay = parseFloat(plan.primaryCareCopay || "0");
        if (planPcpCopay < currentPcpCopay) {
          score += 10;
          reasons.push("Lower primary care copay");
        }

        const currentSpecCopay = parseFloat(currentPlan.specialistCopay || "0");
        const planSpecCopay = parseFloat(plan.specialistCopay || "0");
        if (planSpecCopay < currentSpecCopay) {
          score += 10;
          reasons.push("Lower specialist copay");
        }

        // Avoid Humana if client uses Multicare
        if (client.usesMulticare) {
          const carrier = allPlans.find(p => p.id === plan.carrierId);
          // Note: We'd need to check carrier name, but storage doesn't return it in plan
          // This would need to be enhanced with carrier lookup
        }

        // SNP bonus (if client has qualifying conditions)
        if (plan.isCSnp || plan.isDSnp) {
          score += 15;
          reasons.push(plan.isCSnp ? "C-SNP plan for chronic conditions" : "D-SNP plan for dual-eligible");
        }

        return {
          plan,
          score,
          reasons
        };
      });

      // Sort by score descending
      scoredPlans.sort((a, b) => b.score - a.score);

      // Get top 3 recommendations
      const top3 = scoredPlans.slice(0, 3);

      // Get carriers for display
      const carriers = await storage.getAllCarriers();
      const currentPlanCarrier = carriers.find(c => c.id === currentPlan.carrierId);

      // Build comparison data with carrier names
      const comparisonData = {
        currentPlan: {
          id: currentPlan.id,
          name: currentPlan.name,
          carrierId: currentPlan.carrierId,
          carrierName: currentPlanCarrier?.name || "Unknown",
          monthlyPremium: currentPlan.monthlyPremium,
          annualDeductible: currentPlan.annualDeductible,
          maxOutOfPocket: currentPlan.maxOutOfPocket,
          primaryCareCopay: currentPlan.primaryCareCopay,
          specialistCopay: currentPlan.specialistCopay,
          prescriptionDeductible: currentPlan.prescriptionDeductible,
          planType: currentPlan.planType,
        },
        recommendedPlans: top3.map(({ plan, score, reasons }) => {
          const planCarrier = carriers.find(c => c.id === plan.carrierId);
          return {
            id: plan.id,
            name: plan.name,
            carrierId: plan.carrierId,
            carrierName: planCarrier?.name || "Unknown",
            monthlyPremium: plan.monthlyPremium,
            annualDeductible: plan.annualDeductible,
            maxOutOfPocket: plan.maxOutOfPocket,
            primaryCareCopay: plan.primaryCareCopay,
            specialistCopay: plan.specialistCopay,
            prescriptionDeductible: plan.prescriptionDeductible,
            planType: plan.planType,
            isCSnp: plan.isCSnp,
            isDSnp: plan.isDSnp,
            score,
            reasons
          };
        })
      };

      // Save comparison to database
      const comparison = await storage.createPlanComparison({
        clientId: client.id,
        currentPlanId: currentPlan.id,
        recommendedPlan1Id: top3[0]?.plan.id || null,
        recommendedPlan2Id: top3[1]?.plan.id || null,
        recommendedPlan3Id: top3[2]?.plan.id || null,
        comparisonData: JSON.stringify(comparisonData),
        scoringRationale: JSON.stringify({
          totalPlansConsidered: availablePlans.length,
          topScores: top3.map(t => ({ planId: t.plan.id, score: t.score }))
        })
      });

      res.json({
        comparisonId: comparison.id,
        ...comparisonData
      });
    } catch (error) {
      console.error("Error generating comparison:", error);
      res.status(500).json({ error: "Failed to generate comparison" });
    }
  });

  // Get existing comparison
  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid comparison ID" });
      }

      const comparison = await storage.getPlanComparison(id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      const comparisonData = JSON.parse(comparison.comparisonData || "{}");

      res.json({
        comparisonId: comparison.id,
        clientId: comparison.clientId,
        createdAt: comparison.createdAt,
        ...comparisonData
      });
    } catch (error) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to extract text from PDF or image files
async function extractTextFromDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  // Handle PDF files
  if (ext === '.pdf') {
    let parser: InstanceType<typeof PDFParse> | null = null;
    try {
      // Extract text directly from PDF (works for native PDFs with selectable text)
      const dataBuffer = fs.readFileSync(filePath);
      parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      
      const extractedText = result.text || "";
      
      // Check if PDF is likely scanned (minimal or no text extracted)
      if (extractedText.trim().length < 50) {
        throw new Error('This appears to be a scanned PDF. Please convert the document to JPG or PNG format and re-upload for OCR processing.');
      }
      
      return extractedText;
    } catch (error) {
      // Re-throw if it's already our custom error message
      if (error instanceof Error && error.message.includes('scanned PDF')) {
        throw error;
      }
      console.error('Error processing PDF:', error);
      throw new Error('Failed to extract text from PDF. For scanned documents, please convert to JPG or PNG format.');
    } finally {
      // Clean up parser resources
      if (parser) {
        await parser.destroy();
      }
    }
  }
  
  // Handle image files (JPG, PNG, etc.) - Use Tesseract OCR
  const { data: { text } } = await Tesseract.recognize(
    filePath,
    'eng',
    { logger: () => {} }
  );
  
  return text;
}

// Helper function to parse OCR text and extract client data
function parseOCRText(text: string): Record<string, any> {
  const data: Record<string, any> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Pattern matching for common fields
  const patterns = {
    fullName: /(?:name|patient|client)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    medicareNumber: /(?:medicare|mbi)[\s#:]*([A-Z0-9]{11})/i,
    socialSecurityNumber: /(?:ssn|social\s*security)[\s#:]*(\d{3}-?\d{2}-?\d{4})/i,
    phoneNumber: /(?:phone|tel|mobile)[\s:]*(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i,
    birthdate: /(?:birth|dob|born)[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    address: /(?:address|street)[\s:]*(\d+\s+[A-Za-z0-9\s,]+)/i,
    city: /(?:city)[\s:]*([A-Za-z\s]+)/i,
    zipCode: /(?:zip|postal)[\s:]*(\d{5}(?:-\d{4})?)/i,
    partAStartDate: /(?:part\s*a|medicare\s*a)[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    partBStartDate: /(?:part\s*b|medicare\s*b)[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  };

  // Try to extract each field
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data[field] = match[1].trim();
      
      // Format SSN with dashes
      if (field === 'socialSecurityNumber') {
        data[field] = data[field].replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
      }
      
      // Format phone number
      if (field === 'phoneNumber') {
        data[field] = data[field].replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
      }
    }
  }

  return data;
}

// Helper function to extract plan benefit data from SOB text
function extractPlanBenefits(text: string) {
  const benefits: Record<string, any> = {};
  const upperText = text.toUpperCase();
  
  // Extract plan type (HMO, PPO, etc.)
  const planTypePatterns = [
    /plan\s+type[:\s]*(HMO|PPO|PFFS|RPPO|LPPO|MSA|HMOPOS)/i,
    /(HMO|PPO|PFFS|RPPO|LPPO|MSA|HMOPOS)[\s-]+plan/i,
  ];
  for (const pattern of planTypePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.planType = match[1].toUpperCase();
      break;
    }
  }
  
  // Extract monthly premium
  const premiumPatterns = [
    /monthly\s+(?:plan\s+)?premium[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /premium[:\s]*\$(\d+(?:\.\d{2})?)\s*(?:per month|\/mo|monthly)/i,
    /plan\s+premium[:\s]*\$?(\d+(?:\.\d{2})?)/i,
  ];
  for (const pattern of premiumPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.monthlyPremium = match[1];
      break;
    }
  }
  
  // Extract annual deductible
  const deductiblePatterns = [
    /annual\s+(?:medical\s+)?deductible[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /deductible[:\s]*\$(\d+(?:,\d{3})?(?:\.\d{2})?)\s*(?:per year|annually|\/year)/i,
    /medical\s+deductible[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i
  ];
  for (const pattern of deductiblePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.annualDeductible = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract max out of pocket (in-network)
  const moopPatterns = [
    /(?:maximum|max)\s+out[\s-]+of[\s-]+pocket[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /out[\s-]+of[\s-]+pocket\s+(?:maximum|limit|max)[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /moop[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /in[\s-]+network\s+(?:maximum|max)\s+out[\s-]+of[\s-]+pocket[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i
  ];
  for (const pattern of moopPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.maxOutOfPocket = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract max out of pocket (out-of-network) for PPO
  const moopOONPatterns = [
    /out[\s-]+of[\s-]+network\s+(?:maximum|max)\s+out[\s-]+of[\s-]+pocket[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /moop\s+out[\s-]+of[\s-]+network[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i
  ];
  for (const pattern of moopOONPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.maxOutOfPocketOutNetwork = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract Part B premium reduction/giveback
  const partBGivebackPatterns = [
    /part\s+b\s+(?:premium\s+)?(?:reduction|giveback|rebate)[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /(?:premium\s+)?(?:reduction|giveback|rebate)[:\s]*\$(\d+(?:\.\d{2})?)/i
  ];
  for (const pattern of partBGivebackPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.partBGiveback = match[1];
      break;
    }
  }
  
  // Extract primary care copay
  const primaryCarePatterns = [
    /primary\s+care\s+(?:physician\s+)?(?:visit\s+)?copay(?:ment)?[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /pcp\s+(?:visit\s+)?copay[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /primary\s+care[:\s]*\$(\d+(?:\.\d{2})?)/i
  ];
  for (const pattern of primaryCarePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.primaryCareCopay = match[1];
      break;
    }
  }
  
  // Extract specialist copay
  const specialistPatterns = [
    /specialist\s+(?:visit\s+)?copay(?:ment)?[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /specialist[:\s]*\$(\d+(?:\.\d{2})?)/i
  ];
  for (const pattern of specialistPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.specialistCopay = match[1];
      break;
    }
  }
  
  // Extract inpatient hospital care
  const inpatientPatterns = [
    /inpatient\s+hospital\s+care[:\s]*([^\n]+)/i,
    /hospital\s+stay[:\s]*([^\n]+)/i
  ];
  for (const pattern of inpatientPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.inpatientHospitalCare = match[1].trim();
      break;
    }
  }
  
  // Extract dental allowance
  const dentalPatterns = [
    /dental\s+(?:allowance|benefit|coverage)[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /preventive\s+dental[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i
  ];
  for (const pattern of dentalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.dentalAllowance = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract benefit card (flexible benefits)
  const benefitCardPatterns = [
    /(?:benefit|flex|healthy\s+food)\s+card[:\s]*\$?(\d+)(?:\s+(?:monthly|per\s+month|quarterly|per\s+quarter))?/i,
    /\$(\d+)\s+(?:monthly|quarterly)\s+(?:benefit|allowance)/i
  ];
  for (const pattern of benefitCardPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = match[1];
      const fullMatch = match[0];
      let frequency = 'monthly';
      if (/quarterly|per\s+quarter/i.test(fullMatch)) {
        frequency = 'quarterly';
      }
      benefits.benefitCard = `$${amount} ${frequency}`;
      break;
    }
  }
  
  // Extract OTC credit
  const otcPatterns = [
    /(?:otc|over[\s-]+the[\s-]+counter)\s+(?:credit|allowance|benefit)[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /\$(\d+)\s+(?:otc|over[\s-]+the[\s-]+counter)/i
  ];
  for (const pattern of otcPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.otcCredit = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract OTC frequency (monthly or quarterly)
  const otcFrequencyPatterns = [
    /otc[^\.]*?(monthly|quarterly|per\s+month|per\s+quarter)/i,
    /over[\s-]+the[\s-]+counter[^\.]*?(monthly|quarterly|per\s+month|per\s+quarter)/i
  ];
  for (const pattern of otcFrequencyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const freq = match[1].toLowerCase();
      if (freq.includes('month')) {
        benefits.otcCreditFrequency = 'monthly';
      } else if (freq.includes('quarter')) {
        benefits.otcCreditFrequency = 'quarterly';
      }
      break;
    }
  }
  
  // Extract fitness option
  const fitnessPatterns = [
    /fitness\s+(?:membership|benefit|program)[:\s]*([^\n]+)/i,
    /gym\s+membership[:\s]*([^\n]+)/i,
    /silver[\s&]+fit/i
  ];
  for (const pattern of fitnessPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        benefits.fitnessOption = match[1].trim();
      } else if (/silver[\s&]+fit/i.test(match[0])) {
        benefits.fitnessOption = 'SilverSneakers or similar program';
      }
      break;
    }
  }
  
  // Extract prescription deductible
  const rxDeductiblePatterns = [
    /(?:prescription|drug|rx)\s+deductible[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i,
    /deductible\s+(?:for\s+)?(?:prescription|drug)[:\s]*\$?(\d+(?:,\d{3})?(?:\.\d{2})?)/i
  ];
  for (const pattern of rxDeductiblePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.prescriptionDeductible = match[1].replace(/,/g, '');
      break;
    }
  }
  
  // Extract prescription deductible tiers (1-5 or 3-5)
  const rxDeductibleTiersPatterns = [
    /deductible.*?tiers?\s+(1[\s-]+5|3[\s-]+5)/i,
    /applies\s+to\s+tiers?\s+(1[\s-]+5|3[\s-]+5)/i,
    /tiers?\s+(1[\s-]+5|3[\s-]+5).*?deductible/i
  ];
  for (const pattern of rxDeductibleTiersPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      benefits.prescriptionDeductibleTiers = match[1].replace(/\s/g, '');
      break;
    }
  }
  
  // Extract drug tier copays (Tier 1-5)
  const tierPatterns = [
    { tier: 1, patterns: [
      /tier\s+1[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i,
      /preferred\s+generic[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i
    ]},
    { tier: 2, patterns: [
      /tier\s+2[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i,
      /generic[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i
    ]},
    { tier: 3, patterns: [
      /tier\s+3[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i,
      /preferred\s+brand[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i
    ]},
    { tier: 4, patterns: [
      /tier\s+4[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i,
      /non[\s-]+preferred\s+(?:brand\s+)?drug[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i
    ]},
    { tier: 5, patterns: [
      /tier\s+5[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i,
      /specialty\s+(?:tier\s+)?drug[:\s]*(\d+(?:\.\d{2})?%|\$?\d+(?:\.\d{2})?)/i
    ]}
  ];
  
  for (const { tier, patterns } of tierPatterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = match[1];
        // Detect if it's a percentage or dollar amount
        if (value.includes('%')) {
          // Store the numeric part without % sign
          benefits[`tier${tier}Drugs`] = value.replace(/%/g, '');
          benefits[`tier${tier}DrugsType`] = '%';
        } else {
          // Remove $ sign if present
          benefits[`tier${tier}Drugs`] = value.replace(/\$/g, '');
          benefits[`tier${tier}DrugsType`] = '$';
        }
        break;
      }
    }
  }
  
  // Extract Medicaid levels (for D-SNP)
  if (/d[\s-]+snp|dual[\s-]+eligible/i.test(text)) {
    const medicaidPatterns = [
      /(?:full|partial)\s+(?:benefit\s+)?dual[\s-]+eligible/i,
      /medicaid[:\s]*([^\n]+)/i
    ];
    for (const pattern of medicaidPatterns) {
      const match = text.match(pattern);
      if (match) {
        benefits.medicaidLevels = match[0].trim();
        break;
      }
    }
  }
  
  // Extract counties (Network Service Area)
  const countyPatterns = [
    /(?:available\s+in|service\s+area)[:\s]*([A-Z][a-z]+(?:\s+County)?(?:,\s+[A-Z][a-z]+(?:\s+County)?)*)/i,
    /counties?[:\s]*([A-Z][a-z]+(?:,\s+[A-Z][a-z]+)*)/i
  ];
  for (const pattern of countyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const counties = match[1].split(',').map((c: string) => c.trim()).filter((c: string) => c);
      if (counties.length > 0) {
        benefits.counties = counties;
      }
      break;
    }
  }
  
  // Extract networks in/not in
  const networkInPatterns = [
    /(?:includes|network\s+includes)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/i,
  ];
  for (const pattern of networkInPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const networks = match[1].split(',').map((n: string) => n.trim()).filter((n: string) => n);
      if (networks.length > 0) {
        benefits.networksIn = networks;
      }
      break;
    }
  }
  
  const networkNotInPatterns = [
    /(?:excludes|not\s+in\s+network|network\s+exclusions)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/i,
  ];
  for (const pattern of networkNotInPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const networks = match[1].split(',').map((n: string) => n.trim()).filter((n: string) => n);
      if (networks.length > 0) {
        benefits.networksNotIn = networks;
      }
      break;
    }
  }
  
  return benefits;
}

// Helper function to extract carrier, plan, and document type from plan documents
function parsePlanDocumentText(text: string, carriers: any[], plans: any[]) {
  const upperText = text.toUpperCase();
  const lines = text.split('\n').map(l => l.trim());
  
  // Detect document type based on keywords
  let documentType = "";
  const docTypePatterns = {
    "SOB": ["SUMMARY OF BENEFITS", "SUMMARY OF BENEFIT", "SOB"],
    "EOC": ["EVIDENCE OF COVERAGE", "EOC"],
    "ANOC": ["ANNUAL NOTICE OF CHANGE", "ANNUAL NOTICE OF CHANGES", "ANOC"],
    "PROVIDER_LIST": ["PROVIDER DIRECTORY", "PROVIDER LIST", "PROVIDER NETWORK"],
    "DRUG_FORMULARY": ["DRUG FORMULARY", "FORMULARY", "PRESCRIPTION DRUG LIST", "COVERED DRUGS"]
  };

  for (const [type, keywords] of Object.entries(docTypePatterns)) {
    for (const keyword of keywords) {
      if (upperText.includes(keyword)) {
        documentType = type;
        break;
      }
    }
    if (documentType) break;
  }

  // Extract Medicare plan IDs (e.g., H5216-321, S1234-567)
  const planIdPattern = /[HS]\d{4}-\d{3}/g;
  const foundPlanIds = text.match(planIdPattern) || [];
  
  // Find carrier with better matching logic
  let bestCarrierMatch: any = null;
  let bestCarrierScore = 0;
  const carrierMatches: Array<{name: string, score: number}> = [];

  for (const carrier of carriers) {
    const carrierName = carrier.name.toUpperCase();
    let score = 0;
    
    // Direct substring match (high confidence)
    if (upperText.includes(carrierName)) {
      score = 100;
    } else {
      // Check for partial word matches
      const carrierWords = carrierName.split(/\s+/).filter((w: string) => w.length > 2);
      let matchedWords = 0;
      for (const word of carrierWords) {
        if (upperText.includes(word)) {
          matchedWords++;
        }
      }
      if (carrierWords.length > 0) {
        score = (matchedWords / carrierWords.length) * 100;
      }
    }
    
    carrierMatches.push({ name: carrier.name, score });
    
    if (score > bestCarrierScore) {
      bestCarrierScore = score;
      if (score >= 50) { // More lenient threshold
        bestCarrierMatch = carrier;
      }
    }
  }

  // Sort carrier matches by score
  carrierMatches.sort((a, b) => b.score - a.score);

  // Find plan with better matching logic
  let bestPlanMatch: any = null;
  let bestPlanScore = 0;
  const planMatches: Array<{name: string, carrier: string, score: number}> = [];

  for (const plan of plans) {
    const planName = plan.name.toUpperCase();
    let score = 0;
    
    // Check for plan ID match first (most reliable)
    for (const planId of foundPlanIds) {
      if (planName.includes(planId)) {
        score = 100;
        break;
      }
    }
    
    // Direct substring match
    if (score === 0 && upperText.includes(planName)) {
      score = 90;
    }
    
    // Partial match - check if significant parts of plan name appear
    if (score === 0) {
      const planWords = planName.split(/\s+/).filter((w: string) => w.length > 2);
      let matchedWords = 0;
      for (const word of planWords) {
        if (upperText.includes(word)) {
          matchedWords++;
        }
      }
      if (planWords.length > 0) {
        score = (matchedWords / planWords.length) * 80;
      }
    }
    
    const carrier = carriers.find(c => c.id === plan.carrierId);
    planMatches.push({ 
      name: plan.name, 
      carrier: carrier?.name || "Unknown",
      score 
    });
    
    // Prefer plans from the matched carrier
    if (score > bestPlanScore || 
        (score === bestPlanScore && bestCarrierMatch && plan.carrierId === bestCarrierMatch.id)) {
      bestPlanScore = score;
      if (score >= 40) { // More lenient threshold
        // Strongly prefer plans from matched carrier
        if (!bestCarrierMatch || plan.carrierId === bestCarrierMatch.id) {
          bestPlanMatch = plan;
        } else if (!bestPlanMatch) {
          bestPlanMatch = plan;
        }
      }
    }
  }

  // Sort plan matches by score
  planMatches.sort((a, b) => b.score - a.score);

  // Calculate overall confidence
  let confidence = 0;
  if (bestCarrierMatch && bestPlanMatch) {
    // High confidence if both found and plan belongs to carrier
    if (bestPlanMatch.carrierId === bestCarrierMatch.id) {
      confidence = (bestCarrierScore + bestPlanScore) / 2;
    } else {
      // Lower confidence if carrier mismatch
      confidence = ((bestCarrierScore + bestPlanScore) / 2) * 0.7;
    }
  } else if (bestCarrierMatch || bestPlanMatch) {
    // Medium confidence if only one found
    confidence = Math.max(bestCarrierScore, bestPlanScore) * 0.6;
  }

  // Extract plan benefits if this is an SOB document
  let extractedBenefits = {};
  if (documentType === "SOB") {
    extractedBenefits = extractPlanBenefits(text);
  }

  return {
    carrier: bestCarrierMatch,
    plan: bestPlanMatch,
    documentType: documentType || "UNKNOWN",
    confidence: Math.round(confidence),
    carrierMatches,
    planMatches,
    extractedBenefits,
    detectedPlanIds: foundPlanIds
  };
}
