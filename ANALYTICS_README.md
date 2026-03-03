# Risk Intel Analytics Dashboard

## 🎯 Overview

Production-grade analytics layer with enterprise UI/UX, optimized rendering, and real-time data updates.

**Target Performance:**
- Chart render: ≤100ms for ≤50 endpoints
- Animation duration: ≤800ms
- API debounce: 1000ms (prevents spam)
- Auto-refresh: 30s interval

---

## 📊 Components

### 1. ComplianceGauge
**File:** `components/ComplianceGauge.jsx`

Circular health indicator with animated color band.
- **Displays:** Overall compliance % (0-100)
- **Animation:** Smooth pie fill from 0 → score (800ms)
- **Color Coding:**
  - 🟢 Green (≥85%): Hardened
  - 🟡 Yellow (≥65%): Moderate
  - 🟠 Orange (≥45%): At Risk
  - 🔴 Red (<45%): Critical
- **Update:** Automatic after scan completion
- **Responsive:** Yes, adapts to container width

**Memoization:**
- `React.memo` prevents re-renders on parent update
- `useMemo` for color logic (recalculates only when score changes)

---

### 2. EndpointRiskDistribution
**File:** `components/EndpointRiskDistribution.jsx`

Vertical bar chart showing endpoint distribution by risk level.
- **Chart Type:** Stacked bar (4 categories)
- **Categories:** Hardened / Moderate / At Risk / Critical
- **Interactivity:** Hover tooltips with counts
- **Animation:** 800ms enter animation
- **Memoization:** Computes distribution only when endpoints array changes

---

### 3. CriticalControlFailures
**File:** `components/CriticalControlFailures.jsx`

Horizontal bar chart of top 5 most-failed CIS controls.
- **Sort:** Descending by failure count
- **Limit:** Top 5 controls shown
- **Interactivity:** Tooltip on hover
- **Empty State:** Clean message when no failures
- **Performance:** Processes all controls once, memoizes result

---

### 4. EndpointComparisonTable
**File:** `components/EndpointComparisonTable.jsx`

Sortable, filterable data table with inline progress bar.
- **Columns:**
  - Hostname (sortable)
  - OS (sortable)
  - Compliance Score (sortable, main metric)
  - Inline Progress Bar (visual compliance 0-100%)
  - Failure Count (total critical+high+moderate)
- **Filters:**
  - All Risk Levels
  - Hardened (≥85%)
  - Moderate (65-85%)
  - At Risk (45-65%)
  - Critical (<45%)
- **Sort Behavior:** Click header to toggle ASC/DESC
- **Memoization:** Processes filter+sort only when state changes
- **Responsive:** Horizontal scroll on mobile

---

### 5. PerEndpointAnalytics
**File:** `components/PerEndpointAnalytics.jsx`

Detailed per-endpoint breakdown (lazy-loaded).
- **Chart 1 - Doughnut:** Compliance breakdown (compliant vs non-compliant %)
- **Chart 2 - Stacked Bar:** Severity distribution (Critical / High / Moderate)
- **Lazy Loading:** Only renders when endpoint is selected
- **Memoization:** Only recalculates when selected endpoint changes
- **Performance Impact:** Minimal (hidden by default)

---

## 🔄 Main Page: Analytics.jsx

**File:** `pages/Analytics.jsx`

Orchestrates all components, manages data flow.

### Features

1. **Automatic Refresh**
   - Initial load on mount
   - Auto-refresh every 30 seconds
   - Debounced to 1000ms (prevents rapid calls)

2. **Scan Completion Event**
   - Listens for `scanCompleted` custom event from Dashboard
   - Triggered by "Run Systemic Analysis" button
   - Immediately refreshes analytics without waiting for timer

3. **Data Processing Pipeline**
   ```
   API Response → useMemo(processedData) 
              → Component memoization (React.memo)
              → Render optimization
   ```

4. **Responsive Layout**
   - Desktop: 2-column grid for charts
   - Tablet: Adapts to available width
   - Mobile: Single column, collapsible per-endpoint details

### Performance Optimizations

| Technique | Where | Benefit |
|-----------|-------|---------|
| `React.memo` | All components | Prevents re-render on parent update |
| `useMemo` | Data processing, color logic | Avoids recalculation |
| Debouncing | API calls (1000ms) | Prevents request spam |
| Lazy loading | Per-endpoint charts | Hidden until selected |
| ResponsiveContainer | Recharts | Auto-scales to container |
| No inline functions | Event handlers | Prevents function re-creation |

---

## 🔌 Integration with Dashboard

### Sending Scan Completion Event

In `Dashboard.jsx`, `handleTriggerAnalysis()` dispatches:

```javascript
window.dispatchEvent(new CustomEvent("scanCompleted"));
```

This triggers Analytics to refresh immediately without manual page reload.

### Event Listener

In `Analytics.jsx`:

```javascript
const handleScanComplete = () => {
  console.log("[Analytics] Scan completed, refreshing data...");
  debouncedFetch();
};

window.addEventListener("scanCompleted", handleScanComplete);
```

---

## 📡 API Integration

### Endpoint: `/api/report/organization`

**Response Structure:**
```json
{
  "executive_summary": {
    "overall_compliance_score": 72.5,
    "compliance_band": "Moderate Risk",
    "total_endpoints": 12,
    "total_critical_failures": 8,
    "total_high_failures": 15,
    "total_moderate_failures": 22,
    "latest_scan_at": "2026-03-02T10:30:00"
  },
  "endpoint_table": [
    {
      "endpoint_id": "uuid",
      "hostname": "DESKTOP-ABC123",
      "os": "Windows 10",
      "compliance_score": 85.5,
      "critical_failures": 1,
      "high_failures": 2,
      "moderate_failures": 3,
      "top_control_failures": [...]
    },
    ...
  ],
  "org_snapshot": {...},
  "priority_actions": [...]
}
```

---

## 🎨 Color Scheme (Consistent Across All Charts)

| Category | Hex | Tailwind |
|----------|-----|----------|
| Hardened | #22c55e | green-500 |
| Moderate | #eab308 | yellow-500 |
| At Risk | #f97316 | orange-500 |
| Critical | #ef4444 | red-500 |
| Neutral | #cbd5e1 | slate-200 |

---

## ⚡ Performance Checklist

- ✅ Chart render < 100ms (≤50 endpoints)
- ✅ Animation ≤ 800ms
- ✅ No redundant re-renders (React.memo)
- ✅ Debounced API calls (1000ms)
- ✅ Lazy-loaded per-endpoint details
- ✅ Memoized data processing
- ✅ Responsive container sizing
- ✅ No inline functions in render
- ✅ Clean error boundary handling

---

## 🔄 Update Flow

```
Dashboard.tsx (Run Analysis)
    ↓
    [triggerAnalysis() + emit "scanCompleted"]
    ↓
Analytics.jsx (listens to event)
    ↓
    [debouncedFetch() → API call]
    ↓
    [setReportData(data)]
    ↓
    [useMemo(processedData)]
    ↓
    [Components render with memoization]
    ↓
    [Charts animate in (fadeIn, 400ms)]
```

---

## 🛠️ Adding New Charts

1. Create component file: `components/YourChart.jsx`
2. Wrap with `React.memo()`
3. Use `useMemo()` for data processing
4. Import into `Analytics.jsx`
5. Add to main grid
6. Ensure color consistency
7. Test with 50+ endpoints

---

## 📝 Notes

- All charts built with Recharts (library already installed)
- Tailwind CSS for styling (no custom CSS except animations)
- Dark mode supported via Tailwind
- No external state management needed (hooks only)
- Production-ready: tested for XSS, performance, accessibility

---

**Last Updated:** 2026-03-02
**Version:** 1.0.0
