# Inventory Tracking Feature

## Overview
This document describes the inventory tracking feature that was implemented to track stash inventory changes between snapshots.

## Implementation Summary

### Backend (Rust)

#### 1. WealthSnapshot Structure (`wealth.rs`)
- Added `inventory: Option<HashMap<String, u32>>` field to `WealthSnapshot` struct
- The inventory HashMap stores unique item keys and their quantities
- Item keys are formatted as:
  - For gems: `{name}__{level}__{quality}__{corruption_status}`
  - For other items: `{name}`

#### 2. Inventory Population
Both `wealth_snapshot` and `wealth_snapshot_cached` functions now populate the inventory:
```rust
let mut inventory: HashMap<String, u32> = HashMap::new();

// For each item in stash:
let gl = item.gem_level().unwrap_or(0);
let gq = item.gem_quality().unwrap_or(0);
let gc = item.corrupted();
let is_gem = gl > 0 || gq > 0 || name.is_empty();
let item_key = if is_gem {
    format!("{}__{}__{}__{}", name, gl, gq, if gc { "c" } else { "u" })
} else {
    name.clone()
};
*inventory.entry(item_key).or_insert(0) += item.stack_size().unwrap_or(1);
```

#### 3. Inventory Variance Logic (`price_variance_cached`)
When `baseline_inventory` is provided, the function operates in "inventory" mode:
- Compares current inventory against baseline inventory
- Identifies added items (new or increased quantity)
- Identifies removed items (decreased quantity or completely removed)
- Calculates value impact based on quantity changes and current prices
- Returns changes with `mode: "inventory"` and detailed change information

### Frontend (TypeScript)

#### 1. Type Definitions
Updated interfaces in `IStashLoader.ts` and `e-stashes-view.ts`:
```typescript
// Snapshot type
{
  timestamp: number;
  league: string;
  total_chaos: number;
  total_divines: number | null;
  by_category: Record<string, { chaos: number }>;
  item_prices?: Record<string, number>;
  inventory?: Record<string, number>;  // NEW
}

// Price variance item type
type PriceVarianceItem = {
  name: string;
  category: string;
  qty: number | null;
  snapshotPrice: number;
  currentPrice: number;
  changePercent: number;
  totalChange: number;
  isNew?: boolean;
  isRemoved?: boolean;
  snapshotQty?: number;  // NEW
};
```

#### 2. UI Controls
Added a radio button group to switch between analysis modes:
- **Category**: Shows category-level changes
- **Item Prices**: Shows price changes for individual items
- **Inventory**: Shows quantity changes (additions/removals)

#### 3. Inventory Mode Rendering
When in inventory mode, the UI displays:
- **Net Value Change**: Total value impact of inventory changes
- **Added Items**: Count of items added or increased
- **Removed Items**: Count of items removed or decreased
- **Added/Increased Table**: Shows items with positive quantity changes
- **Removed/Decreased Table**: Shows items with negative quantity changes

Each table row displays:
- Item name and category
- Quantity change (+/- number)
- Current price per unit
- Total value impact

## Usage

### Capturing Snapshots
1. Load your stash tabs (Bulk Load Stash)
2. The snapshot will automatically include inventory data
3. Snapshots are stored in the SQLite database with inventory information

### Viewing Inventory Changes
1. Navigate to the "Price Variance Analysis" section
2. Click "Show Analysis"
3. Select the "Inventory" radio button
4. View added/removed items and their value impact

## Technical Notes

### Item Keying Strategy
- **Gems**: Differentiated by level, quality, and corruption status
  - Example: `Raise Spectre__20__20__c` (level 20, quality 20, corrupted)
- **Other Items**: Keyed by name only
  - Example: `Divine Orb`

### Value Calculation
- Value impact = (quantity change) × (current price)
- Positive values indicate additions (green)
- Negative values indicate removals (red)

### Performance Considerations
- Inventory data is stored in snapshots (no additional API calls needed)
- Comparison is done in-memory on the Rust backend
- Results are cached on the frontend

## Future Enhancements
Potential improvements:
1. Add filtering by item category in inventory mode
2. Export inventory changes to CSV
3. Add historical inventory trend charts
4. Implement alerts for specific item additions/removals
5. Add support for comparing non-consecutive snapshots
