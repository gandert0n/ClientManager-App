import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Carriers table - stores insurance carriers
export const carriers = pgTable("carriers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// States table - US states where plans are available
export const states = pgTable("states", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 2 }).notNull().unique(), // e.g., "WA", "CA"
  name: text("name").notNull(), // e.g., "Washington"
});

// Plans table - stores insurance plans per carrier with benefit details
export const plans = pgTable("plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  planNumber: varchar("plan_number", { length: 100 }), // Plan identifier/contract number
  planYear: integer("plan_year").notNull(),
  stateCode: varchar("state_code", { length: 2 }).references(() => states.code),
  
  // Benefit details - Core costs
  monthlyPremium: numeric("monthly_premium", { precision: 10, scale: 2 }),
  annualDeductible: numeric("annual_deductible", { precision: 10, scale: 2 }),
  maxOutOfPocket: numeric("max_out_of_pocket", { precision: 10, scale: 2 }), // MOOP in-network
  maxOutOfPocketOutNetwork: numeric("max_out_of_pocket_out_network", { precision: 10, scale: 2 }), // MOOP out-of-network (PPO)
  
  // Copays
  specialistCopay: numeric("specialist_copay", { precision: 10, scale: 2 }),
  primaryCareCopay: numeric("primary_care_copay", { precision: 10, scale: 2 }),
  
  // Additional benefits
  partBGiveback: numeric("part_b_giveback", { precision: 10, scale: 2 }), // Part B premium reduction
  inpatientHospitalCare: text("inpatient_hospital_care"), // Description of inpatient coverage
  dentalAllowance: numeric("dental_allowance", { precision: 10, scale: 2 }),
  benefitCard: text("benefit_card"), // e.g., "$50" or "$150"
  benefitCardFrequency: varchar("benefit_card_frequency", { length: 10 }), // "monthly" or "quarterly"
  otcCredit: numeric("otc_credit", { precision: 10, scale: 2 }), // Over the counter credit
  otcCreditFrequency: varchar("otc_credit_frequency", { length: 10 }), // "monthly" or "quarterly"
  fitnessOption: text("fitness_option"), // e.g., "Free gym membership"
  
  // Prescription drug coverage
  prescriptionDeductible: numeric("prescription_deductible", { precision: 10, scale: 2 }),
  prescriptionDeductibleTiers: varchar("prescription_deductible_tiers", { length: 10 }), // "1-5" or "3-5"
  tier1Drugs: text("tier_1_drugs"), // 30-day retail cost
  tier1DrugsType: varchar("tier_1_drugs_type", { length: 1 }).default("$"), // "$" or "%"
  tier2Drugs: text("tier_2_drugs"), // 30-day retail cost
  tier2DrugsType: varchar("tier_2_drugs_type", { length: 1 }).default("$"), // "$" or "%"
  tier3Drugs: text("tier_3_drugs"), // 30-day retail cost
  tier3DrugsType: varchar("tier_3_drugs_type", { length: 1 }).default("%"), // "$" or "%"
  tier4Drugs: text("tier_4_drugs"), // 30-day retail cost
  tier4DrugsType: varchar("tier_4_drugs_type", { length: 1 }).default("%"), // "$" or "%"
  tier5Drugs: text("tier_5_drugs"), // 30-day retail cost
  tier5DrugsType: varchar("tier_5_drugs_type", { length: 1 }).default("%"), // "$" or "%"
  
  // SNP information
  medicaidLevels: text("medicaid_levels"), // For D-SNP plans
  isCSnp: boolean("is_c_snp").default(false), // Chronic Condition SNP
  isDSnp: boolean("is_d_snp").default(false), // Dual-eligible SNP
  
  // Plan type and network
  planType: varchar("plan_type", { length: 50 }), // e.g., "HMO", "PPO", "PFFS"
  counties: text("counties").array(), // Network Service Area - counties where plan is available
  networksIn: text("networks_in").array(), // Networks included (e.g., ["Multicare", "Virginia Mason"])
  networksNotIn: text("networks_not_in").array(), // Networks excluded
  providerNetwork: text("provider_network"), // General network description
  
  // Commission information
  isNoncommissionable: boolean("is_noncommissionable").default(false),
  hasReducedCommissionIfTransferred: boolean("has_reduced_commission_if_transferred").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Staged documents table - temporary storage for uploaded files before assignment
export const stagedDocuments = pgTable("staged_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  
  // Editable metadata (user can change these before assigning)
  displayName: text("display_name"), // User-friendly name
  carrierId: integer("carrier_id").references(() => carriers.id, { onDelete: "set null" }),
  planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  documentType: varchar("document_type", { length: 50 }), // SOB, EOC, ANOC, PROVIDER_LIST, DRUG_FORMULARY
  
  // OCR extracted text (for preview/search)
  extractedText: text("extracted_text"),
  
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Plan documents table - stores uploaded documents for each plan
export const planDocuments = pgTable("plan_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 50 }).notNull(), // SOB, EOC, ANOC, PROVIDER_LIST, DRUG_FORMULARY
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Clients table (database table name remains "patients" for compatibility)
export const clients = pgTable("patients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Personal Information
  fullName: text("full_name").notNull(),
  birthdate: date("birthdate").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  
  // Medicare Details
  medicareNumber: varchar("medicare_number", { length: 20 }).notNull(),
  partAStartDate: date("part_a_start_date"),
  partBStartDate: date("part_b_start_date"),
  
  // Client Status
  clientStatus: varchar("client_status", { length: 20 }).notNull().default("prospect"), // "current_client" or "prospect"
  
  // Current Plan (what client has now)
  currentCarrierId: integer("current_carrier_id").references(() => carriers.id, { onDelete: "set null" }),
  currentPlanId: integer("current_plan_id").references(() => plans.id, { onDelete: "set null" }),
  
  // Recommended Plan (from our portfolio)
  carrierId: integer("carrier_id").references(() => carriers.id, { onDelete: "set null" }),
  planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  
  // Identity & Contact
  socialSecurityNumber: varchar("social_security_number", { length: 11 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  county: varchar("county", { length: 100 }), // County for plan availability checking
  
  // Client Preferences & Goals
  goals: text("goals"), // What the client wants from their plan
  usesMulticare: boolean("uses_multicare").default(false), // Avoid Humana if true
  
  // Medical & Assistance Information
  hasMedicaid: boolean("has_medicaid").default(false), // Client has Medicaid assistance
  hasChronicCondition: boolean("has_chronic_condition").default(false), // Client has chronic condition
  
  // AEP (Annual Enrollment Period) Tracking
  spokeWithThisAep: boolean("spoke_with_this_aep").default(false),
  continueWithCurrentPlan: boolean("continue_with_current_plan").default(false),
  
  // Status tracking
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Medications table - stores drugs for each client
export const medications = pgTable("medications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("patient_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  drugName: text("drug_name").notNull(),
  dosage: text("dosage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Doctors table - stores physicians for each client
export const doctors = pgTable("doctors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("patient_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  specialty: text("specialty"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tasks/Next Steps table - stores action items for each client
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("patient_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  dueDate: date("due_date"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Plan Comparisons table - caches comparison results
export const planComparisons = pgTable("plan_comparisons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  currentPlanId: integer("current_plan_id").references(() => plans.id, { onDelete: "set null" }),
  recommendedPlan1Id: integer("recommended_plan_1_id").references(() => plans.id, { onDelete: "set null" }),
  recommendedPlan2Id: integer("recommended_plan_2_id").references(() => plans.id, { onDelete: "set null" }),
  recommendedPlan3Id: integer("recommended_plan_3_id").references(() => plans.id, { onDelete: "set null" }),
  
  // Comparison metadata
  comparisonData: text("comparison_data"), // JSON string with full comparison details
  scoringRationale: text("scoring_rationale"), // Why these plans were recommended
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comparison Chat History table - stores chat messages for comparison queries
export const comparisonChats = pgTable("comparison_chats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  comparisonId: integer("comparison_id").notNull().references(() => planComparisons.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const carriersRelations = relations(carriers, ({ many }) => ({
  plans: many(plans),
  clients: many(clients),
}));

export const statesRelations = relations(states, ({ many }) => ({
  plans: many(plans),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  carrier: one(carriers, {
    fields: [plans.carrierId],
    references: [carriers.id],
  }),
  state: one(states, {
    fields: [plans.stateCode],
    references: [states.code],
  }),
  documents: many(planDocuments),
  clients: many(clients),
}));

export const planDocumentsRelations = relations(planDocuments, ({ one }) => ({
  plan: one(plans, {
    fields: [planDocuments.planId],
    references: [plans.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  medications: many(medications),
  doctors: many(doctors),
  tasks: many(tasks),
  // Current plan relations
  currentCarrier: one(carriers, {
    fields: [clients.currentCarrierId],
    references: [carriers.id],
  }),
  currentPlan: one(plans, {
    fields: [clients.currentPlanId],
    references: [plans.id],
  }),
  // Recommended plan relations
  carrier: one(carriers, {
    fields: [clients.carrierId],
    references: [carriers.id],
  }),
  plan: one(plans, {
    fields: [clients.planId],
    references: [plans.id],
  }),
}));

export const medicationsRelations = relations(medications, ({ one }) => ({
  client: one(clients, {
    fields: [medications.clientId],
    references: [clients.id],
  }),
}));

export const doctorsRelations = relations(doctors, ({ one }) => ({
  client: one(clients, {
    fields: [doctors.clientId],
    references: [clients.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
}));

export const planComparisonsRelations = relations(planComparisons, ({ one, many }) => ({
  client: one(clients, {
    fields: [planComparisons.clientId],
    references: [clients.id],
  }),
  currentPlan: one(plans, {
    fields: [planComparisons.currentPlanId],
    references: [plans.id],
  }),
  recommendedPlan1: one(plans, {
    fields: [planComparisons.recommendedPlan1Id],
    references: [plans.id],
  }),
  recommendedPlan2: one(plans, {
    fields: [planComparisons.recommendedPlan2Id],
    references: [plans.id],
  }),
  recommendedPlan3: one(plans, {
    fields: [planComparisons.recommendedPlan3Id],
    references: [plans.id],
  }),
  chats: many(comparisonChats),
}));

export const comparisonChatsRelations = relations(comparisonChats, ({ one }) => ({
  comparison: one(planComparisons, {
    fields: [comparisonChats.comparisonId],
    references: [planComparisons.id],
  }),
}));

// Insert schemas - using workaround for drizzle-zod .omit() bug
const baseCarrierSchema = createInsertSchema(carriers);
export const insertCarrierSchema = z.object(baseCarrierSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
});

const baseStateSchema = createInsertSchema(states);
export const insertStateSchema = z.object(baseStateSchema.shape).omit({
  id: true as any,
});

const basePlanSchema = createInsertSchema(plans);
export const insertPlanSchema = z.object(basePlanSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
  updatedAt: true as any,
});

const basePlanDocumentSchema = createInsertSchema(planDocuments);
export const insertPlanDocumentSchema = z.object(basePlanDocumentSchema.shape).omit({
  id: true as any,
  uploadedAt: true as any,
});

const baseStagedDocumentSchema = createInsertSchema(stagedDocuments);
export const insertStagedDocumentSchema = z.object(baseStagedDocumentSchema.shape).omit({
  id: true as any,
  uploadedAt: true as any,
});

const baseClientSchema = createInsertSchema(clients);
export const insertClientSchema = z.object(baseClientSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
  updatedAt: true as any,
}).extend({
  fullName: z.string().min(1, "Full name is required"),
  birthdate: z.string().min(1, "Birthdate is required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
  medicareNumber: z.string().min(1, "Medicare number is required"),
  socialSecurityNumber: z.string().min(9, "Valid SSN required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  // Transform empty strings to undefined for optional date fields
  partAStartDate: z.preprocess((val) => val === "" ? undefined : val, z.string().optional()),
  partBStartDate: z.preprocess((val) => val === "" ? undefined : val, z.string().optional()),
  // Current and recommended plan IDs
  currentCarrierId: z.number().optional(),
  currentPlanId: z.number().optional(),
  carrierId: z.number().optional(),
  planId: z.number().optional(),
  // Optional fields
  clientStatus: z.enum(["current_client", "prospect"]).optional(),
  county: z.string().optional(),
  goals: z.string().optional(),
  usesMulticare: z.boolean().optional(),
  status: z.string().optional(),
  // AEP tracking
  spokeWithThisAep: z.boolean().optional(),
  continueWithCurrentPlan: z.boolean().optional(),
  // Medical & Assistance
  hasMedicaid: z.boolean().optional(),
  hasChronicCondition: z.boolean().optional(),
});

const baseMedicationSchema = createInsertSchema(medications);
export const insertMedicationSchema = z.object(baseMedicationSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
});

const baseDoctorSchema = createInsertSchema(doctors);
export const insertDoctorSchema = z.object(baseDoctorSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
});

const baseTaskSchema = createInsertSchema(tasks);
export const insertTaskSchema = z.object(baseTaskSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
  completedAt: true as any,
}).extend({
  dueDate: z.string().optional(),
});

const basePlanComparisonSchema = createInsertSchema(planComparisons);
export const insertPlanComparisonSchema = z.object(basePlanComparisonSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
});

const baseComparisonChatSchema = createInsertSchema(comparisonChats);
export const insertComparisonChatSchema = z.object(baseComparisonChatSchema.shape).omit({
  id: true as any,
  createdAt: true as any,
});

// Types
export type Carrier = typeof carriers.$inferSelect;
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;

export type State = typeof states.$inferSelect;
export type InsertState = z.infer<typeof insertStateSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type PlanDocument = typeof planDocuments.$inferSelect;
export type InsertPlanDocument = z.infer<typeof insertPlanDocumentSchema>;

export type StagedDocument = typeof stagedDocuments.$inferSelect;
export type InsertStagedDocument = z.infer<typeof insertStagedDocumentSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Medication = typeof medications.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type PlanComparison = typeof planComparisons.$inferSelect;
export type InsertPlanComparison = z.infer<typeof insertPlanComparisonSchema>;

export type ComparisonChat = typeof comparisonChats.$inferSelect;
export type InsertComparisonChat = z.infer<typeof insertComparisonChatSchema>;

// Complex types with relations
export type CarrierWithPlans = Carrier & {
  plans: Plan[];
};

export type PlanWithDocuments = Plan & {
  carrier: Carrier;
  documents: PlanDocument[];
};

export type PlanWithCarrierAndState = Plan & {
  carrier: Carrier;
  state?: State | null;
  documents?: PlanDocument[];
};

export type ClientWithRelations = Client & {
  medications: Medication[];
  doctors: Doctor[];
  tasks: Task[];
  // Current plan (what they have now)
  currentCarrier?: Carrier | null;
  currentPlan?: Plan | null;
  // Recommended plan (from our portfolio)
  carrier?: Carrier | null;
  plan?: Plan | null;
};

// Client completion progress tracking
export type ClientCompletionStatus = {
  personalInfo: boolean;
  medications: boolean;
  doctors: boolean;
  plans: boolean;
  completionPercentage: number;
};

// Document types enum
export const DOCUMENT_TYPES = {
  SOB: "SOB", // Summary of Benefits
  EOC: "EOC", // Evidence of Coverage
  ANOC: "ANOC", // Annual Notice of Changes
  PROVIDER_LIST: "PROVIDER_LIST",
  DRUG_FORMULARY: "DRUG_FORMULARY",
} as const;

export const REQUIRED_DOCUMENT_TYPES = [
  DOCUMENT_TYPES.SOB,
  DOCUMENT_TYPES.EOC,
  DOCUMENT_TYPES.ANOC,
  DOCUMENT_TYPES.PROVIDER_LIST,
  DOCUMENT_TYPES.DRUG_FORMULARY,
];
