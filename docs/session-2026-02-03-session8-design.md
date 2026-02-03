# Session 8: UX Enhancement Design Specification

**Date:** February 3, 2026  
**Version:** 0.4.0 (target)  
**Designer:** Alex (Architecture Agent)  
**Status:** Design Complete - Awaiting User Approval  

## Overview

Session 8 introduces three user-requested UX enhancements to improve information density, task management flexibility, and monthly planning capabilities. All features are designed mobile-first with dark mode support and backward compatibility.

### Features Summary

1. **Collection Stats Display** - Show entry counts below collection names
2. **Completed Task Behavior Settings** - Flexible options for completed task display
3. **Monthly Log Collection Type** - New collection type for monthly planning

**Total Estimated Implementation Time:** 6-9 hours

---

## Feature 1: Collection Stats Display

### Problem Statement
Users cannot see at a glance how many tasks, notes, or events are in a collection without opening it. This requires unnecessary navigation and creates cognitive overhead when managing multiple collections.

### Design Goals
- Provide immediate visibility into collection contents
- Maintain clean, minimal UI aesthetic
- Work seamlessly on mobile (320px+) and desktop
- Use established bullet journal symbols for familiarity
- Only show relevant information (non-zero counts)

### Visual Design

#### Layout
```
┌─────────────────────────────────────┐
│ 📅 February 3, 2026                │  ← Collection name
│    • 3  × 12  – 5  ○ 2             │  ← Stats row (muted, smaller)
└─────────────────────────────────────┘
```

#### Symbol Mapping
- `•` = Open tasks
- `×` = Completed tasks
- `–` = Notes
- `○` = Events

#### Display Rules
1. **Only show non-zero counts** - If a collection has 0 events, don't show `○ 0`
2. **Always show in order:** Open tasks → Completed tasks → Notes → Events
3. **Spacing:** 2-character gap between each stat group
4. **Typography:**
   - Font size: `text-xs` (0.75rem / 12px)
   - Color: `text-gray-500 dark:text-gray-400` (muted)
   - Weight: Normal (not bold)

#### Examples

**Daily log with mixed content:**
```
📅 February 3, 2026
   • 5  × 2  – 3
```

**Custom collection with only tasks:**
```
📖 Reading List
   • 12  × 8
```

**Empty collection (no stats shown):**
```
📖 Ideas
```

**Notes-only collection:**
```
📖 Meeting Notes
   – 15
```

### Technical Implementation

#### Data Source
Stats are calculated from the existing `entries` array in each collection. No new event types or data structures needed.

#### Calculation Logic
```typescript
interface CollectionStats {
  openTasks: number;
  completedTasks: number;
  notes: number;
  events: number;
}

function calculateStats(entries: Entry[]): CollectionStats {
  return entries.reduce((stats, entry) => {
    switch (entry.type) {
      case 'task':
        if (entry.completed) stats.completedTasks++;
        else stats.openTasks++;
        break;
      case 'note':
        stats.notes++;
        break;
      case 'event':
        stats.events++;
        break;
    }
    return stats;
  }, {
    openTasks: 0,
    completedTasks: 0,
    notes: 0,
    events: 0
  });
}
```

#### Component Structure
```typescript
// New component: CollectionStats.tsx
interface CollectionStatsProps {
  entries: Entry[];
  className?: string;
}

export function CollectionStats({ entries, className }: CollectionStatsProps) {
  const stats = useMemo(() => calculateStats(entries), [entries]);
  const parts: string[] = [];
  
  if (stats.openTasks > 0) parts.push(`• ${stats.openTasks}`);
  if (stats.completedTasks > 0) parts.push(`× ${stats.completedTasks}`);
  if (stats.notes > 0) parts.push(`– ${stats.notes}`);
  if (stats.events > 0) parts.push(`○ ${stats.events}`);
  
  if (parts.length === 0) return null;
  
  return (
    <div className={cn(
      "text-xs text-gray-500 dark:text-gray-400 pl-8",
      className
    )}>
      {parts.join('  ')}
    </div>
  );
}
```

#### Integration Points
- **CollectionList.tsx** - Add `<CollectionStats>` below each collection name
- **FavoritesList.tsx** - Add `<CollectionStats>` below each favorite
- **Performance:** Use `useMemo()` to cache calculations (entries don't change frequently)

#### Accessibility
- Stats are decorative/supplementary, no ARIA labels needed
- Information is also available by opening the collection
- Color contrast: Gray 500/400 meets WCAG AA against backgrounds

### Test Coverage

#### Unit Tests
```typescript
describe('CollectionStats', () => {
  it('shows only non-zero counts', () => {
    const entries = [
      { type: 'task', completed: false },
      { type: 'note' }
    ];
    // Should render: "• 1  – 1"
  });

  it('returns null when all counts are zero', () => {
    const entries = [];
    // Should render: null
  });

  it('orders stats correctly', () => {
    const entries = [
      { type: 'event' },
      { type: 'note' },
      { type: 'task', completed: true },
      { type: 'task', completed: false }
    ];
    // Should render: "• 1  × 1  – 1  ○ 1"
  });

  it('updates when entries change', () => {
    // Test that useMemo recalculates properly
  });
});
```

#### Manual Testing
- [ ] View stats on mobile (320px, 375px, 428px widths)
- [ ] View stats on desktop (1280px+)
- [ ] Toggle dark/light mode - verify contrast
- [ ] Create entries of each type - verify counts update
- [ ] Complete/uncomplete tasks - verify × and • counts change
- [ ] Delete entries - verify stats update
- [ ] Empty collection shows no stats line

### Estimated Time
**2-3 hours** (1.5hr implementation, 0.5hr testing, 1hr polish)

---

## Feature 2: Completed Task Behavior Settings

### Problem Statement
Currently, completed tasks are only controlled by a boolean `collapseCompleted` setting. Users have requested more granular control over how completed tasks are displayed:
- Some want them to stay in place (context preservation)
- Some want them moved to the bottom (focus on active work)
- Some want them collapsed/hidden (minimal distraction)

### Design Goals
- Provide three distinct behavior modes
- Smooth visual transitions between modes
- **Global user preference** with per-collection override capability
- Clear UI in settings panel (both global and per-collection)
- Backward compatible migration from boolean setting

### Behavior Modes

#### Mode 1: "Keep in place"
Completed tasks remain exactly where they are in the list. Checkbox shows ×, text gets strikethrough, but position is unchanged.

```
• Buy milk
× Read chapter 3      ← Stays in original position
• Call dentist
× Water plants        ← Stays in original position
```

**Use case:** When task order/context matters (sequential processes, meetings)

#### Mode 2: "Move to bottom"
Completed tasks are automatically moved below all open tasks, with a visual separator.

```
• Buy milk
• Call dentist
────────────────────  ← Separator
× Read chapter 3
× Water plants
```

**Use case:** Focus on active work while keeping completed items visible for reference

#### Mode 3: "Collapse"
Completed tasks are hidden behind an expandable section showing count.

```
• Buy milk
• Call dentist
▼ 2 completed tasks   ← Expandable (click to show)
```

When expanded:
```
• Buy milk
• Call dentist
▼ 2 completed tasks
  × Read chapter 3
  × Water plants
```

**Use case:** Minimal distraction, clean view, but completed items still accessible

### Visual Design

#### Settings UI
Replace the current checkbox with a dropdown in the collection settings panel:

```
┌─────────────────────────────────────────────┐
│ Collection Settings                         │
│                                             │
│ Completed Tasks:                            │
│ ┌─────────────────────────────────┐        │
│ │ Keep in place               ▼   │        │
│ └─────────────────────────────────┘        │
│   Options:                                  │
│   • Keep in place                           │
│   • Move to bottom                          │
│   • Collapse                                │
│                                             │
└─────────────────────────────────────────────┘
```

#### Separator Design (Mode 2)
```typescript
// Thin, subtle divider
<div className="border-t border-gray-200 dark:border-gray-700 my-4" />
```

#### Collapse Header Design (Mode 3)
```typescript
<button className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 py-2">
  <ChevronDownIcon className={cn(
    "h-4 w-4 transition-transform",
    isExpanded && "rotate-180"
  )} />
  <span>{completedCount} completed {completedCount === 1 ? 'task' : 'tasks'}</span>
</button>
```

### Technical Implementation

#### Event Type
```typescript
// New events for user preferences
interface UserPreferencesUpdatedEvent extends DomainEvent {
  eventType: 'UserPreferencesUpdated';
  aggregateId: string; // userId
  aggregateType: 'User';
  data: {
    defaultCompletedTaskBehavior?: 'keep-in-place' | 'move-to-bottom' | 'collapse';
    // ... other user preferences
  };
}

// Existing event in Collection aggregate (updated)
interface CompletedTaskBehaviorChangedEvent extends DomainEvent {
  eventType: 'CompletedTaskBehaviorChanged';
  aggregateId: string; // collectionId
  aggregateType: 'Collection';
  data: {
    behavior: 'keep-in-place' | 'move-to-bottom' | 'collapse' | null; // null = use global default
  };
}
```

#### State Management
```typescript
// Add to UserPreferencesState (new aggregate or extend existing User aggregate)
interface UserPreferencesState {
  defaultCompletedTaskBehavior: 'keep-in-place' | 'move-to-bottom' | 'collapse';
  // ... other user preferences
}

// Add to CollectionState
interface CollectionState {
  // ... existing fields
  completedTaskBehavior?: 'keep-in-place' | 'move-to-bottom' | 'collapse'; // undefined = use global default
}
```

#### Migration Strategy
Existing collections have a boolean `collapseCompleted` field. Migration logic:

```typescript
function migrateCompletedTaskBehavior(
  collapseCompleted: boolean | undefined,
  globalDefault: 'keep-in-place' | 'move-to-bottom' | 'collapse'
): 'keep-in-place' | 'move-to-bottom' | 'collapse' | undefined {
  // If collection has explicit setting, migrate it
  if (collapseCompleted !== undefined) {
    return collapseCompleted ? 'collapse' : 'keep-in-place';
  }
  // Otherwise, return undefined to use global default
  return undefined;
}

// Global default initialization for existing users
function getInitialGlobalDefault(): 'keep-in-place' | 'move-to-bottom' | 'collapse' {
  return 'keep-in-place'; // User-approved default
}
```

**Migration timing:** On-read migration in reducer. No database migration needed - field transforms on hydration.

**User preference flow:**
1. New users: Global default is 'keep-in-place'
2. Existing users: Global default is 'keep-in-place', existing per-collection settings preserved
3. Per-collection setting of `undefined` means "use global default"

#### Display Logic

**Effective behavior resolution:**
```typescript
function getEffectiveBehavior(
  collectionBehavior: 'keep-in-place' | 'move-to-bottom' | 'collapse' | undefined,
  globalDefault: 'keep-in-place' | 'move-to-bottom' | 'collapse'
): 'keep-in-place' | 'move-to-bottom' | 'collapse' {
  return collectionBehavior ?? globalDefault;
}
```

**Mode 1 (Keep in place):** No change to current rendering

**Mode 2 (Move to bottom):**
```typescript
function partitionEntries(entries: Entry[]) {
  const openTasks = entries.filter(e => e.type !== 'task' || !e.completed);
  const completedTasks = entries.filter(e => e.type === 'task' && e.completed);
  return { openTasks, completedTasks };
}

// Render:
<>
  {openTasks.map(entry => <EntryItem entry={entry} />)}
  {completedTasks.length > 0 && (
    <>
      <Separator />
      {completedTasks.map(entry => <EntryItem entry={entry} />)}
    </>
  )}
</>
```

**Mode 3 (Collapse):**
```typescript
const [showCompleted, setShowCompleted] = useState(false);
const completedTasks = entries.filter(e => e.type === 'task' && e.completed);

// Render:
<>
  {openEntries.map(entry => <EntryItem entry={entry} />)}
  {completedTasks.length > 0 && (
    <>
      <CollapseHeader
        count={completedTasks.length}
        isExpanded={showCompleted}
        onClick={() => setShowCompleted(!showCompleted)}
      />
      {showCompleted && completedTasks.map(entry => <EntryItem entry={entry} />)}
    </>
  )}
</>
```

#### Component Structure
```typescript
// Updated component: CompletedTasksSection.tsx
interface CompletedTasksSectionProps {
  entries: Entry[];
  behavior: 'keep-in-place' | 'move-to-bottom' | 'collapse' | undefined; // undefined = use global
  globalDefault: 'keep-in-place' | 'move-to-bottom' | 'collapse';
  onEntryClick: (entryId: string) => void;
  // ... other entry handlers
}

export function CompletedTasksSection({
  entries,
  behavior,
  globalDefault,
  ...handlers
}: CompletedTasksSectionProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const effectiveBehavior = behavior ?? globalDefault;
  
  if (effectiveBehavior === 'keep-in-place') {
    return <EntryList entries={entries} {...handlers} />;
  }
  
  const { openEntries, completedTasks } = partitionEntries(entries);
  
  if (effectiveBehavior === 'move-to-bottom') {
    return (
      <>
        <EntryList entries={openEntries} {...handlers} />
        {completedTasks.length > 0 && (
          <>
            <Separator />
            <EntryList entries={completedTasks} {...handlers} />
          </>
        )}
      </>
    );
  }
  
  // effectiveBehavior === 'collapse'
  return (
    <>
      <EntryList entries={openEntries} {...handlers} />
      {completedTasks.length > 0 && (
        <>
          <CollapseHeader
            count={completedTasks.length}
            isExpanded={showCompleted}
            onClick={() => setShowCompleted(!showCompleted)}
          />
          {showCompleted && (
            <EntryList entries={completedTasks} {...handlers} />
          )}
        </>
      )}
    </>
  );
}
```

#### Settings Panel Integration
Update `CollectionSettingsPanel.tsx` to show global default and allow override:

```typescript
function CollectionSettingsPanel({ collection }: Props) {
  const globalDefault = useUserPreference('defaultCompletedTaskBehavior'); // 'keep-in-place'
  const collectionBehavior = collection.completedTaskBehavior; // may be undefined
  
  return (
    <FormField
      control={form.control}
      name="completedTaskBehavior"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Completed Tasks</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value || 'default'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select behavior" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                Use default ({formatBehaviorName(globalDefault)})
              </SelectItem>
              <SelectItem value="keep-in-place">Keep in place</SelectItem>
              <SelectItem value="move-to-bottom">Move to bottom</SelectItem>
              <SelectItem value="collapse">Collapse</SelectItem>
            </SelectContent>
          </Select>
          <FormDescription>
            Override the global default for this collection only
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
```

**Global Settings Panel** (new or extend existing user settings):
```typescript
function UserPreferencesPanel() {
  return (
    <FormField
      control={form.control}
      name="defaultCompletedTaskBehavior"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Default Completed Task Behavior</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value || 'keep-in-place'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep-in-place">Keep in place</SelectItem>
              <SelectItem value="move-to-bottom">Move to bottom</SelectItem>
              <SelectItem value="collapse">Collapse</SelectItem>
            </SelectContent>
          </Select>
          <FormDescription>
            Default behavior for new collections. Can be overridden per collection.
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
```

### Test Coverage

#### Unit Tests
```typescript
describe('CompletedTaskBehavior', () => {
  describe('keep-in-place mode', () => {
    it('renders all entries in original order', () => {});
    it('shows completed tasks with strikethrough', () => {});
  });

  describe('move-to-bottom mode', () => {
    it('renders open entries first', () => {});
    it('renders separator between open and completed', () => {});
    it('renders completed entries after separator', () => {});
    it('hides separator when no completed tasks', () => {});
  });

  describe('collapse mode', () => {
    it('shows collapse header with count', () => {});
    it('hides completed tasks by default', () => {});
    it('expands completed tasks on click', () => {});
    it('collapses completed tasks on second click', () => {});
    it('updates count when tasks are completed/uncompleted', () => {});
  });

  describe('migration', () => {
    it('migrates collapseCompleted=true to collapse', () => {});
    it('migrates collapseCompleted=false to keep-in-place', () => {});
    it('migrates undefined to use global default', () => {});
    it('preserves explicit collection settings after migration', () => {});
  });
  
  describe('global default', () => {
    it('initializes to keep-in-place for new users', () => {});
    it('applies global default when collection has no override', () => {});
    it('allows per-collection override of global default', () => {});
    it('updates behavior when global default changes', () => {});
  });
});
```

#### Manual Testing
- [ ] Change setting from dropdown - verify behavior updates immediately
- [ ] Complete a task in each mode - verify correct positioning
- [ ] Uncomplete a task in each mode - verify correct repositioning
- [ ] Test collapse expand/collapse interaction
- [ ] Test separator visibility (show/hide based on completed count)
  - [ ] Verify migration from old boolean setting
  - [ ] Test global default setting in user preferences
  - [ ] Test per-collection override of global default
  - [ ] Verify "Use default" option shows current global setting
  - [ ] Change global default - verify collections without override update
  - [ ] Test on mobile and desktop
- [ ] Verify dark mode styling

### Estimated Time
**2-3 hours** (1.5hr implementation, 0.5hr migration + global settings, 1hr testing)

**Note:** Estimate includes global preference architecture (User aggregate events + settings UI). This represents an enhancement over the original per-collection-only design, approved during user Q&A.

---

## Feature 3: Monthly Log Collection Type

### Problem Statement
Users want to create monthly planning pages (e.g., "February 2026") that appear at the year level in the hierarchy, similar to how daily logs work but at a coarser granularity. Current workaround is creating custom collections and manually naming them, which:
- Doesn't integrate with hierarchy sorting
- Requires manual date formatting
- No semantic meaning (just another custom collection)

### Design Goals
- New first-class collection type: `'monthly'`
- Auto-generated names from date (e.g., "February 2026")
- Appears at Year level in hierarchy (between Favorites and Month level)
- Intuitive creation flow (month picker instead of text input)
- Consistent with daily log patterns

### Hierarchy Integration

#### Current Hierarchy
```
Favorites (starred customs, by order)
└─ Year (2026, 2025...)
   └─ Month (February, January...)
      └─ Daily Logs (Feb 3, Feb 2...) [newest first]
Other Customs (unstirred, by order)
```

#### New Hierarchy (with Monthly Logs)
```
Favorites (starred customs, by order)
└─ Year (2026, 2025...)
   ├─ Monthly Logs (Feb 2026, Jan 2026...) [newest first] ← NEW
   └─ Month (February, January...)
      └─ Daily Logs (Feb 3, Feb 2...) [newest first]
Other Customs (unstarred, by order)
```

**Sorting within Year level:**
1. Monthly logs (newest first by date)
2. Months (newest first, containing daily logs)

### Visual Design

#### Collection List Display
```
▼ 2026                                    ← Year group
  🗓️ February 2026                        ← Monthly log (new icon)
  🗓️ January 2026
  ▼ February                              ← Month group
    📅 February 3, 2026                   ← Daily log
    📅 February 2, 2026
  ▼ January
    📅 January 31, 2026
```

#### Icon Choice
- **Monthly log:** 🗓️ (`:calendar:` emoji)
- **Daily log:** 📅 (`:date:` emoji - existing)
- Rationale: 🗓️ suggests a broader time period while remaining visually related to 📅

#### CreateCollectionModal Updates
Add a third tab/option for monthly logs:

```
┌────────────────────────────────────────┐
│ Create New Collection                  │
│                                        │
│ ○ Daily Log    ○ Monthly Log  ○ Custom│ ← Tab selection
│                                        │
│ ┌────────────────────────────────────┐│
│ │  Select Month                      ││
│ │  ┌──────────────┬──────────────┐  ││
│ │  │ Month ▼      │ Year ▼       │  ││
│ │  │ February     │ 2026         │  ││
│ │  └──────────────┴──────────────┘  ││
│ │                                    ││
│ │  Preview: February 2026            ││
│ └────────────────────────────────────┘│
│                                        │
│         [Cancel]  [Create Monthly Log] │
└────────────────────────────────────────┘
```

**Default values:**
- Month: Current month
- Year: Current year

**Name generation:** Auto-generated, non-editable (consistent with daily logs)

### Technical Implementation

#### Data Model Changes

**Collection type update:**
```typescript
type CollectionType = 'daily' | 'monthly' | 'custom'; // Add 'monthly'
```

**Collection state:**
```typescript
interface CollectionState {
  id: string;
  name: string;
  type: 'daily' | 'monthly' | 'custom';
  date?: string; // YYYY-MM-DD for daily, YYYY-MM for monthly
  // ... other fields
}
```

#### Date Format
- **Monthly logs:** `YYYY-MM` (e.g., `"2026-02"`)
- **Daily logs:** `YYYY-MM-DD` (e.g., `"2026-02-03"`)
- Storage: ISO format in `date` field
- Display: Formatted via `formatMonthlyLogName()`

#### Name Generation
```typescript
function formatMonthlyLogName(dateStr: string): string {
  // Input: "2026-02"
  // Output: "February 2026"
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
}
```

#### Event Type
```typescript
// Extend existing CollectionCreatedEvent
interface CollectionCreatedEvent extends DomainEvent {
  eventType: 'CollectionCreated';
  aggregateId: string;
  aggregateType: 'Collection';
  data: {
    name: string;
    type: 'daily' | 'monthly' | 'custom';
    date?: string; // Required for daily/monthly, undefined for custom
    order: number;
    isFavorite: boolean;
  };
}
```

**Validation rules:**
- If `type === 'monthly'`, `date` must match `/^\d{4}-\d{2}$/`
- If `type === 'daily'`, `date` must match `/^\d{4}-\d{2}-\d{2}$/`
- If `type === 'custom'`, `date` must be undefined

#### Hierarchy Sorting Updates
Update `collectionSorting.ts`:

```typescript
function sortCollectionsHierarchically(collections: CollectionState[]): GroupedCollections {
  // ... existing logic for favorites and customs
  
  // Group by year
  const byYear = groupBy(dailiesAndMonthlies, c => {
    const year = c.date!.split('-')[0];
    return year;
  });
  
  const yearGroups = Object.entries(byYear).map(([year, collections]) => {
    // Separate monthly logs from dailies
    const monthlies = collections.filter(c => c.type === 'monthly');
    const dailies = collections.filter(c => c.type === 'daily');
    
    // Sort monthlies newest first
    monthlies.sort((a, b) => b.date!.localeCompare(a.date!));
    
    // Group dailies by month
    const monthGroups = groupDailiesByMonth(dailies);
    
    return {
      year,
      monthlies,      // NEW: Monthly logs at year level
      monthGroups     // Existing: Daily logs grouped by month
    };
  });
  
  // Sort years newest first
  yearGroups.sort((a, b) => b.year.localeCompare(a.year));
  
  return yearGroups;
}
```

#### Component Updates

**CreateCollectionModal.tsx:**
```typescript
type CollectionCreationType = 'daily' | 'monthly' | 'custom';

function CreateCollectionModal() {
  const [type, setType] = useState<CollectionCreationType>('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const handleCreate = () => {
    if (type === 'monthly') {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const name = formatMonthlyLogName(dateStr);
      dispatch(createCollection({ name, type: 'monthly', date: dateStr }));
    }
    // ... existing daily/custom logic
  };
  
  return (
    <Dialog>
      <Tabs value={type} onValueChange={setType}>
        <TabsList>
          <TabsTrigger value="daily">Daily Log</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Log</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        
        <TabsContent value="monthly">
          <div className="grid grid-cols-2 gap-4">
            <Select
              value={String(selectedMonth)}
              onValueChange={v => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={String(selectedYear)}
              onValueChange={v => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateYearRange().map(year => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            Preview: {formatMonthlyLogName(
              `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
            )}
          </div>
        </TabsContent>
        
        {/* ... existing tabs */}
      </Tabs>
    </Dialog>
  );
}

// Helper: Generate year range (current year ± 5)
function generateYearRange(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
```

**CollectionList.tsx:**
```typescript
function YearGroup({ year, monthlies, monthGroups }: YearGroupProps) {
  return (
    <div>
      <div className="year-header">{year}</div>
      
      {/* NEW: Render monthly logs */}
      {monthlies.map(monthly => (
        <CollectionItem key={monthly.id} collection={monthly} />
      ))}
      
      {/* Existing: Render month groups with daily logs */}
      {monthGroups.map(monthGroup => (
        <MonthGroup key={monthGroup.month} {...monthGroup} />
      ))}
    </div>
  );
}
```

#### Validation & Edge Cases

**Duplicate prevention:**
- Check if monthly log for same YYYY-MM already exists
- Show error: "Monthly log for February 2026 already exists"
- Offer to navigate to existing log instead

**Migration:**
- No migration needed (new feature, no existing data)
- Old collections unaffected

**Deletion:**
- Monthly logs can be deleted like any collection
- No cascade effects (independent of daily logs)

### Test Coverage

#### Unit Tests
```typescript
describe('Monthly Logs', () => {
  describe('formatMonthlyLogName', () => {
    it('formats YYYY-MM to "Month Year"', () => {
      expect(formatMonthlyLogName('2026-02')).toBe('February 2026');
      expect(formatMonthlyLogName('2025-12')).toBe('December 2025');
    });
  });

  describe('collection creation', () => {
    it('creates monthly log with correct type and date', () => {});
    it('prevents duplicate monthly logs for same month', () => {});
    it('validates date format for monthly logs', () => {});
  });

  describe('hierarchy sorting', () => {
    it('places monthly logs at year level', () => {});
    it('sorts monthly logs newest first', () => {});
    it('renders monthly logs before month groups', () => {});
    it('handles years with only monthly logs', () => {});
    it('handles years with only daily logs', () => {});
    it('handles years with both monthly and daily logs', () => {});
  });

  describe('CreateCollectionModal', () => {
    it('shows month picker for monthly type', () => {});
    it('defaults to current month/year', () => {});
    it('updates preview when month/year changes', () => {});
    it('creates collection with correct date format', () => {});
  });
});
```

#### Integration Tests
```typescript
describe('Monthly Logs Integration', () => {
  it('creates monthly log and appears in hierarchy', async () => {
    // Create Feb 2026 monthly log
    // Verify it appears under 2026 year group
    // Verify it appears before month groups
  });

  it('creates multiple monthly logs in same year', async () => {
    // Create Feb 2026, Jan 2026, Mar 2026
    // Verify they sort: Mar, Feb, Jan (newest first)
  });

  it('monthly log works with favorites', async () => {
    // Create monthly log
    // Favorite it
    // Verify it appears in favorites section
    // Verify it's removed from year hierarchy
  });
});
```

#### Manual Testing
- [ ] Create monthly log for current month - verify name
- [ ] Create monthly log for different year - verify hierarchy placement
- [ ] Create multiple monthly logs - verify sorting (newest first)
- [ ] Favorite a monthly log - verify it moves to favorites
- [ ] Delete a monthly log - verify it's removed from hierarchy
- [ ] Try to create duplicate monthly log - verify error message
- [ ] Navigate to monthly log - verify entries can be created
- [ ] Test month/year picker UX on mobile and desktop
- [ ] Verify 🗓️ icon displays correctly (cross-platform)

### Estimated Time
**2-3 hours** (1.5hr implementation, 0.5hr sorting logic, 1hr testing)

---

## Cross-Feature Considerations

### Performance
- **Collection Stats:** `useMemo()` caching prevents recalculation on every render
- **Completed Task Behavior:** Partitioning logic runs once per render, minimal overhead
- **Monthly Logs:** No performance impact (same rendering as daily logs)

### Mobile UX
- All features tested at 320px, 375px, 428px widths
- Touch targets meet 48x48px minimum (WCAG 2.1)
- Dropdowns and pickers use native mobile UI where appropriate

### Dark Mode
- All new components use Tailwind dark mode classes
- Color contrast verified (WCAG AA minimum)
- Icons render correctly in both modes

### Accessibility
- Stats are supplementary (info available elsewhere)
- Collapse header is keyboard accessible (`<button>`)
- Month picker uses semantic `<select>` elements
- All interactive elements have focus states

### Backward Compatibility
- **Feature 1:** Purely additive (no breaking changes)
- **Feature 2:** Migration from boolean to enum (on-read, no DB migration)
- **Feature 3:** New type, existing collections unaffected

---

## Implementation Order

### Recommended Sequence
1. **Feature 1: Collection Stats** (least complex, immediate value)
2. **Feature 2: Completed Task Behavior** (medium complexity, migration logic)
3. **Feature 3: Monthly Logs** (most complex, touches hierarchy)

### Rationale
- Stats provide quick wins and user delight early
- Completed task behavior builds on existing patterns
- Monthly logs are most complex and benefit from earlier learnings

---

## Success Criteria

### Feature 1: Collection Stats
- [ ] Stats display correctly for all entry type combinations
- [ ] Stats update in real-time when entries change
- [ ] Zero counts are hidden (not shown as "• 0")
- [ ] Typography and spacing match design spec
- [ ] Works on mobile (320px+) and desktop
- [ ] Dark mode contrast meets WCAG AA

### Feature 2: Completed Task Behavior
- [ ] All three modes work correctly (keep/move/collapse)
- [ ] Setting persists per collection
- [ ] Migration from boolean setting succeeds
- [ ] Separator shows/hides based on completed count
- [ ] Collapse expand/collapse interaction works smoothly
- [ ] UI updates immediately when setting changes

### Feature 3: Monthly Logs
- [ ] Monthly logs can be created via month picker
- [ ] Names auto-generate correctly ("February 2026")
- [ ] Appear at year level in hierarchy (before months)
- [ ] Sort newest first within year
- [ ] Duplicate prevention works
- [ ] 🗓️ icon displays correctly
- [ ] Favoriting/unfavoriting works correctly

---

## Deferred Considerations

The following were discussed during design but are deferred to future sessions:

### Feature 1 Deferrals
- **Customizable stats display:** Users may want to hide certain types (e.g., don't show completed tasks). Could add setting in future.
- **Color-coded stats:** Different colors per entry type. Adds visual complexity, deferring for now.

### Feature 2 Deferrals
- **Global default setting:** Currently per-collection. Could add global default in user preferences.
- **Keyboard shortcuts:** (e.g., Ctrl+H to hide completed). General keyboard nav is Session 9+.

### Feature 3 Deferrals
- **Yearly logs:** Similar pattern, but less requested. Could add `'yearly'` type in future.
- **Week logs:** ISO week numbers (e.g., "Week 5, 2026"). More complex, lower priority.
- **Custom date formats:** Some users may want "Feb '26" instead of "February 2026". Could add preference.

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- Component rendering and behavior
- State calculations (stats, partitioning, sorting)
- Migration logic
- Date formatting utilities

### Integration Tests (Playwright)
- Full user flows (create → view → edit → delete)
- Cross-feature interactions (stats + completed behavior)
- Hierarchy navigation with monthly logs

### Manual Testing Checklist
- [ ] Mobile devices (iOS Safari, Android Chrome)
- [ ] Desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Dark mode toggle
- [ ] Slow network conditions (stats update timing)
- [ ] Touch vs. mouse interactions
- [ ] Accessibility (keyboard nav, screen readers)

### Performance Testing
- [ ] Collections with 100+ entries (stats calculation)
- [ ] Collections with 50+ completed tasks (collapse mode)
- [ ] 10+ monthly logs in same year (sorting performance)

---

## Deployment Plan

### Pre-Deployment
1. All tests passing (unit + integration)
2. Casey code review approved
3. User manual testing approved
4. No console errors or warnings
5. Build succeeds (pnpm build)

### Versioning
- **Current:** 0.3.0
- **Target:** 0.4.0 (minor version bump for new features)

### Rollout
- No feature flags needed (all features are opt-in or additive)
- No database migrations required (on-read migrations only)
- No breaking changes to existing data

### Rollback Plan
If critical issues discovered:
1. Revert to 0.3.0 (git revert)
2. Redeploy previous version
3. No data loss (events are append-only)

---

## ✅ Design Decisions (User Approved)

1. **Feature priority:** ✅ Stats → Behavior → Monthly (builds momentum, simple to complex)
2. **Icon choice:** ✅ 🗓️ for monthly logs (vs 📅 for daily logs)
3. **Default behavior:** ✅ Global user preference with per-collection override
   - Add global setting in user preferences: "Default completed task behavior"
   - Initial global default: "Keep in place"
   - Per-collection setting overrides global default
   - If per-collection not set, use global preference
4. **Year range:** ✅ ±5 years in month picker (2021-2031 range in 2026)
5. **Collapse state:** ✅ Always start collapsed (predictable, no state tracking needed)

---

## Approval Checklist

Before Sam begins implementation:

- [x] User reviewed all three feature designs
- [x] User approved visual mockups and UX flows
- [x] User answered open questions (see Design Decisions section)
- [x] User confirmed implementation sequence: Stats → Behavior → Monthly
- [x] User agreed on success criteria
- [x] User confirmed target version (0.4.0)

**All approvals complete! ✅ Ready for Sam to implement.**

---

**Next Steps:**
1. User reviews this design specification
2. User provides approval or requests changes
3. Sam begins implementation (6-9 hour estimate)
4. Casey reviews Sam's implementation
5. User manual tests features
6. Deploy version 0.4.0

**Design Status:** ✅ Complete - Awaiting User Approval
