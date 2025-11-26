# Price Comparison Logic Analysis & Optimization

## 1. Logic Verification
The price comparison logic in `prices.rs` (`price_sources_matrix`) was analyzed.
- **Edge Cases**: The code robustly handles null values, missing fields, and different JSON structures (e.g., `chaos` vs `chaosValue`) using Rust's `Option` types and combinators (`and_then`, `or_else`).
- **Currency Formats**: All prices are normalized to Chaos Orbs (`f32`).
- **Matching**: The algorithm uses a multi-stage matching process:
    1. Exact name match.
    2. Normalized (lowercase + trimmed) name match.
    3. Variant-specific matching (for Essences).
    4. Tier-specific matching (for Maps).

## 2. Performance Evaluation
- **Original State**: The function fetched data from ~13 different endpoints sequentially. This resulted in high latency, especially if any single endpoint was slow.
- **Optimization**: We implemented `tokio::join!` to fetch all data sources in parallel. This significantly reduces the total wait time to the duration of the slowest request, rather than the sum of all requests.
- **Scalability**:
    - The current implementation builds large in-memory HashMaps. For 100k+ items, this is manageable in Rust but could be optimized further by streaming or using more efficient data structures if memory becomes a constraint.
    - **Recommendation**: Implement caching for the Ninja API responses within `price_sources_matrix` to avoid hitting the API on every request if the user toggles views frequently.

## 3. Unit Tests
Comprehensive unit tests were added to `prices.rs` covering:
- **Equal Prices**: Verifying logic when sources agree.
- **Significant Differences**: Ensuring large variances are detected.
- **Floating Point Precision**: Verifying tolerance for small float differences.
- **Edge Cases**: Testing `null`, missing fields, and malformed data.

## 4. Integration
The optimized logic is fully integrated into the `price_sources_matrix` Tauri command, which is used by the frontend `e-stashes-view` component. The changes are backward compatible and require no frontend modifications.
