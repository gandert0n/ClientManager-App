# Mini CRM Web Application Design Guidelines

## Design Approach

**Selected Approach:** Design System - Modern Data Application
Drawing inspiration from **Linear, Notion, and Airtable** for their clean, efficient data management interfaces that prioritize usability while maintaining visual appeal.

**Core Principles:**
- Clarity over decoration: Every element serves a functional purpose
- Efficient data scanning: Information hierarchy enables quick comprehension
- Consistent interactions: Predictable patterns reduce cognitive load
- Professional sophistication: Clean aesthetics that build trust

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts CDN) - excellent for interfaces and data
- Monospace: JetBrains Mono - for SSN, Medicare numbers, dates

**Hierarchy:**
- Page Titles: 2xl, semibold
- Section Headers: xl, semibold  
- Card Titles: lg, medium
- Body/Labels: base, medium
- Form Labels: sm, medium, uppercase tracking-wide
- Input Text: base, regular
- Table Headers: sm, semibold, uppercase tracking-wide
- Table Data: sm, regular
- Meta/Helper Text: xs, regular

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 20**
- Micro spacing (between related elements): 2, 4
- Component internal padding: 4, 6, 8
- Section spacing: 12, 16, 20
- Page margins: 8, 12

**Container Strategy:**
- Dashboard Shell: Full-width with sidebar navigation
- Content Area: max-w-7xl with px-8 py-6
- Forms: max-w-3xl centered
- Modals: max-w-2xl

**Grid Patterns:**
- Dashboard Cards: 3-column grid (grid-cols-3) for stat cards
- Record List: Full-width data table
- Form Fields: 2-column grid for related inputs (Name/DOB, Part A/Part B dates)

---

## Application Structure

### 1. Navigation (Sidebar - Left)
- Fixed left sidebar (w-64)
- Logo/branding at top (h-16)
- Navigation items with icons from Heroicons
- Active state indication with background accent
- Bottom section for user profile/settings

**Nav Items:**
- Dashboard (home icon)
- New Intake (plus-circle icon)
- All Records (folder icon)
- Search (magnifying-glass icon)
- Settings (cog icon)

### 2. Dashboard View
**Top Section:**
- Welcome header with current date
- Quick stats in 3-card grid:
  - Total Records
  - Pending Applications
  - Completed This Month
- Each stat card: Large number (3xl), label below (sm), subtle icon

**Main Content:**
- Recent entries table (5-7 rows)
- "Next Steps Due" section highlighting records with upcoming tasks
- Quick action buttons

### 3. Intake Form Page
**Layout:**
- Centered form container (max-w-3xl)
- Clear page title
- Logical section grouping with subtle dividers

**Form Sections:**
1. Personal Information
   - Name (full width)
   - Birthdate, Phone (2-col grid)
   
2. Medicare Details
   - Medicare Number (full, monospace)
   - Part A Start Date, Part B Start Date (2-col)
   
3. Identity & Contact
   - Social Security Number (monospace, masked input)
   - Address (full)
   - City, State, ZIP (flexible grid)

4. Medications
   - Drug input with autocomplete dropdown
   - Display added drugs as removable chips/tags
   - Each chip shows drug name and dosage

5. Submit Section
   - Primary submit button (w-full on mobile, w-auto on desktop)
   - Cancel/Clear secondary option

### 4. Records List/Search View
**Top Bar:**
- Search input (w-96) with icon
- Filter dropdowns (Status, Date Range)
- "New Record" button (primary, right-aligned)

**Table Design:**
- Alternating row backgrounds for scannability
- Sticky header row
- Columns: Name | DOB | Medicare # | Status | Last Updated | Actions
- Row hover state reveals action icons (view, edit, delete)
- Status badges with color coding (Pending, In Progress, Completed)

### 5. Record Detail/Edit View
**Two-Column Layout:**
**Left Column (2/3 width):**
- Editable form fields (same as intake)
- Save/Cancel buttons at bottom

**Right Column (1/3 width):**
- Next Steps panel (sticky)
- Add task input
- Task list with checkboxes
- Each task: checkbox, description, due date, delete icon
- Completed tasks move to collapsed "Completed" section

---

## Component Library

### Input Fields
- Border style: rounded-md with focus ring
- Label positioning: above input
- Helper text below when needed
- Error states: red border, error message below
- Required field indicator: red asterisk

### Autocomplete Dropdown
- Appears below input on focus/typing
- Maximum 6 visible suggestions, scrollable
- Keyboard navigation (arrows, enter)
- Highlight matching characters
- Shows drug name (bold) + common dosage (lighter)

### Buttons
**Primary:** Solid background, medium padding (px-6 py-2.5)
**Secondary:** Outline style with border
**Danger:** Red variant for delete actions
**Icon Buttons:** Square (p-2) for table actions

### Status Badges
- Pill shape (rounded-full)
- Subtle backgrounds with darker text
- Small padding (px-3 py-1)
- Uppercase text (xs)

### Cards
- Rounded corners (rounded-lg)
- Subtle shadow
- Padding (p-6)
- Hover elevation for interactive cards

### Tables
- Minimal borders (border-b on rows)
- Generous cell padding (px-4 py-3)
- Align numbers right, text left
- Icon buttons in actions column

### Modals
- Overlay with backdrop blur
- Centered modal with max-width
- Close icon (top-right)
- Title, content area, action buttons at bottom

---

## Key Interactions

**Search/Filter:**
- Real-time search as user types (debounced)
- Filter chips appear above table when active
- Clear all filters option

**Drug Autocomplete:**
- Trigger dropdown after 2 characters typed
- Show loading indicator while fetching
- Display "No results" state
- Click or Enter to select

**Task Management:**
- Add task: Enter adds to list
- Mark complete: Checkbox with strikethrough animation
- Delete task: Hover reveals delete icon

**Form Validation:**
- Real-time validation on blur
- Required field checks on submit
- Date format validation
- Phone number formatting

---

## Accessibility Implementation
- ARIA labels on all interactive elements
- Keyboard navigation throughout (Tab, Arrow keys, Enter, Escape)
- Focus visible states on all focusable elements
- Form inputs properly labeled with `for` attributes
- Error messages announced to screen readers
- Sufficient color contrast (WCAG AA minimum)

---

**No Images Required** - This is a data-focused application where functionality takes precedence over imagery.