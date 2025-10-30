# MediCare CRM - Client Intake Management System

## Overview

MediCare CRM is a full-stack client intake management system designed for Medicare applications. It enables healthcare administrators to efficiently track client information, medications, doctors, and application progress. Key capabilities include client intake form management with client status tracking (Current Client vs Prospect), county-based plan lookup, an intelligent recommendation engine for plan suggestions, comprehensive plan document tracking with a staged workflow, OCR document upload for auto-filling data, robust AEP tracking, and an advanced Plan Comparison Engine. The system features a Master Management System for carriers and plans with in-form creation dialogs, a dashboard with statistics, complete CRUD operations for client records with edit-lock functionality, a plan summary card displaying key plan metrics, CSV batch upload for clients, and intelligent plan comparison with scoring algorithm.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18, TypeScript, and Vite, utilizing Wouter for routing and TanStack Query for server state management. UI design is based on Shadcn/ui with Radix UI primitives and Tailwind CSS, following an aesthetic inspired by Linear, Notion, and Airtable. Custom theming with CSS variables and Inter font are used. Form management is handled by React Hook Form and Zod for validation, integrated with Drizzle-zod for type-safe validation. Key components include client intake forms with client status selection (Current Client/Prospect), county field for plan lookup, doctors management with specialty dropdown (10+ medical specialties), a Master Management system with dialog-based carrier/plan creation (featuring scrollable sections for carriers, states, and plans with 600px viewport height, compact plan cards displaying only name/year/state, and comprehensive plan edit dialog with all 37 plan fields organized into sections: Basic Information, Costs & Deductibles, Copays, Additional Benefits with frequency selectors, Prescription Drug Coverage with tier types, Network & SNP Information, Market Service Area, and Commission Information), Plan Comparison, Staged Documents for file uploads with metadata editing, and a Task Management system. OCR document upload functionality is supported via a drag-and-drop component. Client detail view features edit-lock functionality with dedicated Edit/Save/Cancel buttons, editable plan selectors (carrier and plan) when in edit mode, and a Plan Summary Card displaying comprehensive plan metrics with proper currency formatting. The All Records page displays client information in a table with a "Current Plan" column showing carrier name and plan ID, with inline quick-edit buttons to change plans via dialog without leaving the table view. The Plans page now includes a comprehensive plan details view displaying all 30+ plan fields in an organized grid layout with inline editing capability (Edit/Save/Cancel buttons for both plan details and plan name), showing basic info, costs, copays, additional benefits (Part B giveback, dental, OTC, fitness, benefit card frequency), drug tiers 1-5, hospital care, network information, and Market Service Area (counties field for plan comparison matching). Plan cards in the list view display plan name, year, and plan number (if set). Both Master Management and Plans & Docs pages now support full editing of all plan fields.

### Backend Architecture

The backend uses Express.js with TypeScript and ESM modules, providing a RESTful API. Endpoints cover CRUD operations for clients (renamed from patients), carriers, plans, medications, doctors, and tasks. All API routes use `/api/clients/*` pattern. Specific endpoints support CSV import, AEP tracking, and a comprehensive Staged Documents workflow for managing uploads, metadata, and assignment to plans. OCR processing is integrated via `/api/ocr/process` for document data extraction. Multer middleware handles file uploads, and consistent error handling is implemented. Business logic utilizes a storage interface pattern with Drizzle ORM for data access, optimizing queries to avoid N+1 issues. Doctors are persisted with client creation/updates, including specialty field for medical categorization.

### Data Storage

PostgreSQL, hosted on Neon serverless, is used as the database, accessed via Drizzle ORM for type-safe queries and migrations. The schema includes tables for `carriers`, `states`, `plans` (with benefit details and document tracking), `staged_documents` (temporary storage for uploads), `plan_documents`, `patients` (database table name preserved, but TypeScript types renamed to "Client" - includes personal, Medicare, current/recommended plan, client status enum [current_client/prospect], county field, and AEP tracking details), `doctors` (with name, specialty dropdown field, phone number), `medications`, and `tasks`. Relations are defined using Drizzle's API, and timestamp tracking is enabled. Required plan document types include SOB, EOC, ANOC, Provider Directory, and Drug Formulary. Uploaded files are stored locally in `uploaded_documents/` with secure naming conventions. Data validation is shared between frontend and backend using `drizzle-zod`.

**Recent Schema Changes (October 2025):**
- Terminology Migration: All TypeScript types changed from "Patient" to "Client" (database column names remain as "patient_id" for safety)
- Added `clientStatus` field: enum with values "current_client" or "prospect" for client categorization
- Added `county` field: text field for county-based plan lookup functionality
- Enhanced `doctors` table: added `specialty` field with dropdown options (Primary Care, Dentist, Cardiologist, Endocrinologist, Nephrologist, Neurologist, Oncologist, Orthopedist, Pulmonologist, Other)
- **Plan Comparison Engine (Oct 28, 2025)**:
  - Extended `plans` table: added `maxOutOfPocket`, `isCSnp`, `isDSnp`, `planType`, `providerNetwork` fields
  - Added `planComparisons` table: caches comparison results with scoring rationale
  - Added `comparisonChats` table: stores AI chat history for comparison queries (ready for LLM integration)
- **Comprehensive Plan Details (Oct 28, 2025)**:
  - Extended `plans` table with 20+ new fields: `maxOutOfPocketOutNetwork`, `partBGiveback`, `inpatientHospitalCare`, `dentalAllowance`, `benefitCard`, `otcCredit`, `fitnessOption`, `tier1Drugs` through `tier5Drugs`, `medicaidLevels`, `networksIn`, `networksNotIn`
  - Enhanced OCR extraction to detect all comprehensive plan fields including drug tiers, networks, and supplemental benefits
  - OCR now extracts 25+ data points from SOB documents including plan type, copays, deductibles, Part B giveback, dental, OTC, fitness, inpatient care, drug tier pricing, Medicaid levels, and network information
- **Prescription Coverage Enhancement (Oct 28, 2025)**:
  - Added `prescriptionDeductibleTiers` field: dropdown with "1-5" or "3-5" options to indicate which tiers the deductible applies to
  - Added `tier1DrugsType` through `tier5DrugsType` fields: selector for "$" or "%" to indicate if tier pricing is dollar amount or percentage-based
  - Added `otcCreditFrequency` field: dropdown with "monthly" or "quarterly" options for OTC credit distribution frequency
  - Enhanced OCR extraction to automatically detect prescription deductible tier ranges (1-5 vs 3-5), tier pricing types ($ vs %), and OTC credit frequency from SOB documents
- **Client Medical Information (Oct 28, 2025)**:
  - Added `hasMedicaid` boolean field: checkbox to track if client has Medicaid assistance
  - Added `hasChronicCondition` boolean field: checkbox to indicate if client has a chronic condition
  - Enhanced `clients` table with doctors management: inline editing for doctor name, specialty (with medical specialty dropdown), and phone number
  - Doctors are persisted with client records and displayed alongside medications in client detail view
- **Commission Tracking (Oct 28, 2025)**:
  - Added `isNoncommissionable` boolean field: checkbox to mark plans that don't generate commission
  - Added `hasReducedCommissionIfTransferred` boolean field: checkbox to indicate plans with reduced commission when transferred
  - Commission checkboxes displayed in dedicated "Commission Information" section on plan details page
  - Commission fields editable in plan edit mode with persistence across reloads
- **Market Service Area & UI Improvements (Oct 29, 2025)**:
  - Added Market Service Area section to Master Management plan dialog with counties input field (comma-separated) for comparison matching
  - Added Market Service Area field to Plans & Docs edit page with inline editing capability
  - Master Management page now features scrollable sections for carriers, states, and plans (600px viewport height)
  - Plan cards in Master Management simplified to compact format displaying only plan name, year, and state (removed benefit details for cleaner overview)
  - Plans displayed in responsive 3-column grid (1 column on mobile, 2 on tablet, 3 on desktop)
  - Added Plan Number field to plans table and Plans & Docs edit page (varchar 100 chars, optional field for plan identifier/contract number)
  - Added Benefit Card Frequency field: dropdown with "monthly" or "quarterly" options for benefit card distribution frequency
- **Interactive Plan Comparison Selectors (Oct 29, 2025)**:
  - Implemented real-time plan swapping in comparison view: users can now change any of the 3 recommended plans via carrier and plan dropdowns in column headers
  - Cascading selectors: carrier dropdown filters available plans, plan dropdown updates when carrier changes
  - Benefits table automatically refreshes when plans are swapped, showing updated premiums, copays, deductibles, and all other benefit fields
  - State persistence: user selections persist across query refetches (focus changes, network reconnects) via initialization guard
  - Column alignment maintained: empty state shows "N/A" when carrier is selected but plan is not chosen yet, preventing data misalignment
  - All 4 columns (current plan + 3 recommendations) remain properly aligned during plan swapping operations

### Development & Deployment

The application uses Vite for client builds and esbuild for server builds, supporting separate development and production environments. Hot Module Replacement (HMR) is enabled during development. Environment variables are used for database connection and session management.

## External Dependencies

**Database Services:**
- Neon Serverless PostgreSQL

**Third-Party Libraries:**
- Radix UI (Headless accessible components)
- Lucide React (Icons)
- date-fns (Date utilities)
- cmdk (Command palette)
- embla-carousel-react (Carousel)
- vaul (Drawer primitives)
- Multer (File uploads)
- Tesseract.js (Pure JavaScript OCR for images)
- pdf-parse (PDF text extraction)
- string-similarity (Fuzzy matching)

**Form & Validation:**
- Zod (Schema validation)
- React Hook Form (Form state management)
- @hookform/resolvers (Zod integration for React Hook Form)

**State Management:**
- TanStack Query (Server state, caching)
- React Context (UI state)

**Development Tools:**
- tsx (TypeScript execution)
- esbuild (Bundler)
- Drizzle Kit (Database migrations)
- PostCSS with Tailwind CSS and Autoprefixer

**Fonts:**
- Google Fonts CDN (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)