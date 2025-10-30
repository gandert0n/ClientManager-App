// Referenced from javascript_database blueprint
import { 
  clients, 
  medications, 
  doctors,
  tasks,
  carriers,
  plans,
  planDocuments,
  stagedDocuments,
  states,
  planComparisons,
  comparisonChats,
  type Client, 
  type InsertClient,
  type Medication,
  type InsertMedication,
  type Doctor,
  type InsertDoctor,
  type Task,
  type InsertTask,
  type ClientWithRelations,
  type ClientCompletionStatus,
  type Carrier,
  type InsertCarrier,
  type Plan,
  type InsertPlan,
  type PlanDocument,
  type InsertPlanDocument,
  type StagedDocument,
  type InsertStagedDocument,
  type PlanWithDocuments,
  type PlanWithCarrierAndState,
  type State,
  type InsertState,
  type PlanComparison,
  type InsertPlanComparison,
  type ComparisonChat,
  type InsertComparisonChat,
  REQUIRED_DOCUMENT_TYPES,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, ne, or, inArray } from "drizzle-orm";

export interface IStorage {
  // Carriers
  getAllCarriers(): Promise<Carrier[]>;
  getCarrier(id: number): Promise<Carrier | undefined>;
  createCarrier(carrier: InsertCarrier): Promise<Carrier>;
  deleteCarrier(id: number): Promise<void>;
  
  // States
  getAllStates(): Promise<State[]>;
  getState(code: string): Promise<State | undefined>;
  createState(state: InsertState): Promise<State>;
  deleteState(code: string): Promise<void>;
  
  // Plans
  getAllPlans(): Promise<PlanWithCarrierAndState[]>;
  getPlansByCarrier(carrierId: number): Promise<PlanWithCarrierAndState[]>;
  getPlansByState(stateCode: string): Promise<PlanWithCarrierAndState[]>;
  getPlan(id: number): Promise<PlanWithDocuments | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: number, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: number): Promise<void>;
  
  // Plan Documents
  getDocumentsByPlan(planId: number): Promise<PlanDocument[]>;
  getMissingDocuments(planId: number): Promise<string[]>;
  createPlanDocument(document: InsertPlanDocument): Promise<PlanDocument>;
  deletePlanDocument(id: number): Promise<void>;
  
  // Staged Documents
  getAllStagedDocuments(): Promise<StagedDocument[]>;
  getStagedDocument(id: number): Promise<StagedDocument | undefined>;
  createStagedDocument(document: InsertStagedDocument): Promise<StagedDocument>;
  updateStagedDocument(id: number, document: Partial<InsertStagedDocument>): Promise<StagedDocument | undefined>;
  deleteStagedDocument(id: number): Promise<void>;
  assignStagedDocumentToPlan(stagedId: number): Promise<PlanDocument | undefined>;
  
  // Recommendations
  getRecommendedPlans(clientId: number): Promise<PlanWithCarrierAndState[]>;
  
  // Clients
  getAllClients(): Promise<Client[]>;
  getClient(id: number): Promise<ClientWithRelations | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;
  
  // Medications
  getMedicationsByClient(clientId: number): Promise<Medication[]>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  deleteMedicationsByClient(clientId: number): Promise<void>;
  
  // Doctors
  getDoctorsByClient(clientId: number): Promise<Doctor[]>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  deleteDoctorsByClient(clientId: number): Promise<void>;
  
  // Tasks
  getTasksByClient(clientId: number): Promise<Task[]>;
  getAllIncompleteTasks(): Promise<Array<Task & { client: Client }>>;
  createTask(task: InsertTask): Promise<Task>;
  toggleTask(taskId: number): Promise<Task | undefined>;
  deleteTask(taskId: number): Promise<void>;
  
  // Progress tracking
  getClientCompletionStatus(clientId: number): Promise<ClientCompletionStatus>;
  
  // Plan Comparisons
  createPlanComparison(comparison: InsertPlanComparison): Promise<PlanComparison>;
  getPlanComparison(id: number): Promise<PlanComparison | undefined>;
  getClientComparisons(clientId: number): Promise<PlanComparison[]>;
  deletePlanComparison(id: number): Promise<void>;
  
  // Comparison Chats
  createComparisonChat(chat: InsertComparisonChat): Promise<ComparisonChat>;
  getComparisonChats(comparisonId: number): Promise<ComparisonChat[]>;
  getPlanDocuments(planId: number): Promise<PlanDocument[]>;
}

export class DatabaseStorage implements IStorage {
  // Carriers
  async getAllCarriers(): Promise<Carrier[]> {
    return await db.select().from(carriers).orderBy(carriers.name);
  }

  async getCarrier(id: number): Promise<Carrier | undefined> {
    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, id));
    return carrier || undefined;
  }

  async createCarrier(insertCarrier: InsertCarrier): Promise<Carrier> {
    const [carrier] = await db.insert(carriers).values(insertCarrier).returning();
    return carrier;
  }

  async deleteCarrier(id: number): Promise<void> {
    await db.delete(carriers).where(eq(carriers.id, id));
  }

  // States
  async getAllStates(): Promise<State[]> {
    return await db.select().from(states).orderBy(states.name);
  }

  async getState(code: string): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.code, code));
    return state || undefined;
  }

  async createState(insertState: InsertState): Promise<State> {
    const [state] = await db.insert(states).values(insertState).returning();
    return state;
  }

  async deleteState(code: string): Promise<void> {
    await db.delete(states).where(eq(states.code, code));
  }

  // Plans
  async getAllPlans(): Promise<PlanWithCarrierAndState[]> {
    const plansList = await db.select().from(plans).orderBy(desc(plans.planYear), plans.name);
    
    const enrichedPlans: PlanWithCarrierAndState[] = [];
    for (const plan of plansList) {
      const [carrier] = await db.select().from(carriers).where(eq(carriers.id, plan.carrierId));
      const [state] = plan.stateCode ? await db.select().from(states).where(eq(states.code, plan.stateCode)) : [null];
      enrichedPlans.push({
        ...plan,
        carrier,
        state,
      });
    }
    return enrichedPlans;
  }

  async getPlansByCarrier(carrierId: number): Promise<PlanWithCarrierAndState[]> {
    const plansList = await db.select().from(plans).where(eq(plans.carrierId, carrierId)).orderBy(desc(plans.planYear), plans.name);
    
    const enrichedPlans: PlanWithCarrierAndState[] = [];
    for (const plan of plansList) {
      const [carrier] = await db.select().from(carriers).where(eq(carriers.id, plan.carrierId));
      const [state] = plan.stateCode ? await db.select().from(states).where(eq(states.code, plan.stateCode)) : [null];
      enrichedPlans.push({
        ...plan,
        carrier,
        state,
      });
    }
    return enrichedPlans;
  }

  async getPlansByState(stateCode: string): Promise<PlanWithCarrierAndState[]> {
    const plansList = await db
      .select()
      .from(plans)
      .where(eq(plans.stateCode, stateCode))
      .orderBy(desc(plans.planYear), plans.name);

    const enrichedPlans: PlanWithCarrierAndState[] = [];
    for (const plan of plansList) {
      const [carrier] = await db.select().from(carriers).where(eq(carriers.id, plan.carrierId));
      const [state] = plan.stateCode ? await db.select().from(states).where(eq(states.code, plan.stateCode)) : [null];
      enrichedPlans.push({
        ...plan,
        carrier,
        state,
      });
    }
    return enrichedPlans;
  }

  async getPlan(id: number): Promise<PlanWithDocuments | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    if (!plan) return undefined;

    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, plan.carrierId));
    if (!carrier) return undefined;

    const documents = await db.select().from(planDocuments).where(eq(planDocuments.planId, id));

    return {
      ...plan,
      carrier,
      documents,
    };
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const [plan] = await db.insert(plans).values(insertPlan).returning();
    return plan;
  }

  async updatePlan(id: number, updatePlan: Partial<InsertPlan>): Promise<Plan | undefined> {
    const [plan] = await db
      .update(plans)
      .set({ ...updatePlan, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return plan || undefined;
  }

  async deletePlan(id: number): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  // Plan Documents
  async getDocumentsByPlan(planId: number): Promise<PlanDocument[]> {
    return await db.select().from(planDocuments).where(eq(planDocuments.planId, planId));
  }

  async getMissingDocuments(planId: number): Promise<string[]> {
    const existingDocs = await this.getDocumentsByPlan(planId);
    const existingTypes = new Set(existingDocs.map(doc => doc.documentType));
    return REQUIRED_DOCUMENT_TYPES.filter(type => !existingTypes.has(type));
  }

  async createPlanDocument(insertDoc: InsertPlanDocument): Promise<PlanDocument> {
    const [doc] = await db.insert(planDocuments).values(insertDoc).returning();
    return doc;
  }

  async deletePlanDocument(id: number): Promise<void> {
    await db.delete(planDocuments).where(eq(planDocuments.id, id));
  }

  // Staged Documents
  async getAllStagedDocuments(): Promise<StagedDocument[]> {
    return await db.select().from(stagedDocuments).orderBy(desc(stagedDocuments.uploadedAt));
  }

  async getStagedDocument(id: number): Promise<StagedDocument | undefined> {
    const [doc] = await db.select().from(stagedDocuments).where(eq(stagedDocuments.id, id));
    return doc || undefined;
  }

  async createStagedDocument(insertDoc: InsertStagedDocument): Promise<StagedDocument> {
    const [doc] = await db.insert(stagedDocuments).values(insertDoc).returning();
    return doc;
  }

  async updateStagedDocument(id: number, updateDoc: Partial<InsertStagedDocument>): Promise<StagedDocument | undefined> {
    const [doc] = await db
      .update(stagedDocuments)
      .set(updateDoc)
      .where(eq(stagedDocuments.id, id))
      .returning();
    return doc || undefined;
  }

  async deleteStagedDocument(id: number): Promise<void> {
    await db.delete(stagedDocuments).where(eq(stagedDocuments.id, id));
  }

  async assignStagedDocumentToPlan(stagedId: number): Promise<PlanDocument | undefined> {
    // Get the staged document
    const staged = await this.getStagedDocument(stagedId);
    if (!staged || !staged.planId || !staged.documentType) {
      return undefined;
    }

    // Create the plan document
    const planDoc = await this.createPlanDocument({
      planId: staged.planId,
      documentType: staged.documentType,
      fileName: staged.displayName || staged.originalName,
      filePath: staged.filePath,
      fileSize: staged.fileSize || 0,
    });

    // Delete the staged document
    await this.deleteStagedDocument(stagedId);

    return planDoc;
  }

  // Recommendations
  async getRecommendedPlans(clientId: number): Promise<PlanWithCarrierAndState[]> {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return [];

    // Get client's current carrier if it exists
    let currentCarrierId: number | null = client.currentCarrierId;
    
    // If client doesn't have a state, return empty
    if (!client.state) return [];

    // Get all plans in client's state
    let candidatePlans = await db
      .select()
      .from(plans)
      .where(eq(plans.stateCode, client.state))
      .orderBy(desc(plans.planYear));

    // Filter out plans based on business rules
    candidatePlans = candidatePlans.filter(plan => {
      // Rule 1: Don't suggest plans from the same carrier as current plan
      if (currentCarrierId && plan.carrierId === currentCarrierId) {
        return false;
      }

      // Rule 2: Filter by county availability
      if (client.county && plan.counties && plan.counties.length > 0) {
        const countyMatch = plan.counties.some(
          c => c.toLowerCase().trim() === client.county?.toLowerCase().trim()
        );
        if (!countyMatch) return false;
      }

      return true;
    });

    // Enrich with carrier and state information
    const enrichedPlans: PlanWithCarrierAndState[] = [];
    for (const plan of candidatePlans) {
      const [carrier] = await db.select().from(carriers).where(eq(carriers.id, plan.carrierId));
      const [state] = plan.stateCode ? await db.select().from(states).where(eq(states.code, plan.stateCode)) : [null];

      // Rule 3: Avoid Humana if client uses Multicare
      if (client.usesMulticare && carrier?.name.toLowerCase().includes('humana')) {
        continue;
      }

      enrichedPlans.push({
        ...plan,
        carrier,
        state,
      });
    }

    // Score plans based on similarity to current plan and return top 3
    const scoredPlans = enrichedPlans.map(plan => {
      let score = 0;

      // Get current plan for comparison
      const getCurrentPlan = async () => {
        if (client.currentPlanId) {
          const [current] = await db.select().from(plans).where(eq(plans.id, client.currentPlanId));
          return current;
        }
        return null;
      };

      // Basic scoring: prefer plans with complete benefit information
      if (plan.monthlyPremium) score += 10;
      if (plan.annualDeductible) score += 10;
      if (plan.specialistCopay) score += 10;
      if (plan.primaryCareCopay) score += 10;
      if (plan.prescriptionDeductible) score += 10;

      return { plan, score };
    });

    // Sort by score and return top 3
    scoredPlans.sort((a, b) => b.score - a.score);
    return scoredPlans.slice(0, 3).map(sp => sp.plan);
  }

  // Clients
  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: number): Promise<ClientWithRelations | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;

    const clientMedications = await db.select().from(medications).where(eq(medications.clientId, id));
    const clientDoctors = await db.select().from(doctors).where(eq(doctors.clientId, id));
    const clientTasks = await db.select().from(tasks).where(eq(tasks.clientId, id)).orderBy(tasks.createdAt);

    // Fetch current carrier and plan
    let currentCarrier: Carrier | null = null;
    let currentPlan: Plan | null = null;
    
    if (client.currentCarrierId) {
      const [c] = await db.select().from(carriers).where(eq(carriers.id, client.currentCarrierId));
      currentCarrier = c || null;
    }

    if (client.currentPlanId) {
      const [p] = await db.select().from(plans).where(eq(plans.id, client.currentPlanId));
      currentPlan = p || null;
    }

    // Fetch recommended carrier and plan
    let carrier: Carrier | null = null;
    let plan: Plan | null = null;

    if (client.carrierId) {
      const [c] = await db.select().from(carriers).where(eq(carriers.id, client.carrierId));
      carrier = c || null;
    }

    if (client.planId) {
      const [p] = await db.select().from(plans).where(eq(plans.id, client.planId));
      plan = p || null;
    }

    return {
      ...client,
      medications: clientMedications,
      doctors: clientDoctors,
      tasks: clientTasks,
      currentCarrier,
      currentPlan,
      carrier,
      plan,
    };
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async updateClient(id: number, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Medications
  async getMedicationsByClient(clientId: number): Promise<Medication[]> {
    return await db.select().from(medications).where(eq(medications.clientId, clientId));
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const [med] = await db.insert(medications).values(medication).returning();
    return med;
  }

  async deleteMedicationsByClient(clientId: number): Promise<void> {
    await db.delete(medications).where(eq(medications.clientId, clientId));
  }

  // Doctors
  async getDoctorsByClient(clientId: number): Promise<Doctor[]> {
    return await db.select().from(doctors).where(eq(doctors.clientId, clientId));
  }

  async createDoctor(doctor: InsertDoctor): Promise<Doctor> {
    const [newDoctor] = await db.insert(doctors).values(doctor).returning();
    return newDoctor;
  }

  async deleteDoctorsByClient(clientId: number): Promise<void> {
    await db.delete(doctors).where(eq(doctors.clientId, clientId));
  }

  // Tasks
  async getTasksByClient(clientId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.clientId, clientId));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async toggleTask(taskId: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return undefined;

    const [updatedTask] = await db
      .update(tasks)
      .set({
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updatedTask || undefined;
  }

  async deleteTask(taskId: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  async getAllIncompleteTasks(): Promise<Array<Task & { client: Client }>> {
    const result = await db
      .select()
      .from(tasks)
      .innerJoin(clients, eq(tasks.clientId, clients.id))
      .where(eq(tasks.completed, false))
      .orderBy(tasks.dueDate, tasks.createdAt);

    return result.map(row => ({
      ...row.tasks,
      client: row.clients,
    }));
  }

  // Progress tracking
  async getClientCompletionStatus(clientId: number): Promise<ClientCompletionStatus> {
    const client = await this.getClient(clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    // Check personal info completion (key fields)
    const personalInfo = !!(
      client.fullName &&
      client.birthdate &&
      client.phoneNumber &&
      client.medicareNumber
    );

    // Check medications completion
    const hasMedications = client.medications && client.medications.length > 0;

    // Check doctors completion
    const hasDoctors = client.doctors && client.doctors.length > 0;

    // Check plans completion (either current or recommended plan)
    const hasPlans = !!(client.currentPlanId || client.planId);

    // Calculate completion percentage
    const categories = [personalInfo, hasMedications, hasDoctors, hasPlans];
    const completedCount = categories.filter(Boolean).length;
    const completionPercentage = Math.round((completedCount / categories.length) * 100);

    return {
      personalInfo,
      medications: hasMedications,
      doctors: hasDoctors,
      plans: hasPlans,
      completionPercentage,
    };
  }

  // Plan Comparisons
  async createPlanComparison(comparison: InsertPlanComparison): Promise<PlanComparison> {
    const [newComparison] = await db.insert(planComparisons).values(comparison).returning();
    return newComparison;
  }

  async getPlanComparison(id: number): Promise<PlanComparison | undefined> {
    const [comparison] = await db.select().from(planComparisons).where(eq(planComparisons.id, id));
    return comparison || undefined;
  }

  async getClientComparisons(clientId: number): Promise<PlanComparison[]> {
    return await db.select().from(planComparisons)
      .where(eq(planComparisons.clientId, clientId))
      .orderBy(desc(planComparisons.createdAt));
  }

  async deletePlanComparison(id: number): Promise<void> {
    await db.delete(planComparisons).where(eq(planComparisons.id, id));
  }

  // Comparison Chats
  async createComparisonChat(chat: InsertComparisonChat): Promise<ComparisonChat> {
    const [newChat] = await db.insert(comparisonChats).values(chat).returning();
    return newChat;
  }

  async getComparisonChats(comparisonId: number): Promise<ComparisonChat[]> {
    return await db.select().from(comparisonChats)
      .where(eq(comparisonChats.comparisonId, comparisonId))
      .orderBy(comparisonChats.createdAt);
  }

  async getPlanDocuments(planId: number): Promise<PlanDocument[]> {
    return await db.select().from(planDocuments).where(eq(planDocuments.planId, planId));
  }
}

export const storage = new DatabaseStorage();
