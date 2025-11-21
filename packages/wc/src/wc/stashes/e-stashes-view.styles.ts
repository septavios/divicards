import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	:host {
		display: block;
		/* Remove fixed max-width to allow container to control it, or keep it large */
		width: 100%;
	}

	.main-stashes-component {
		position: relative;
        display: flex;
    flex-direction: column;
        gap: 0.25rem;
	}

	wc-help-tip::part(tooltip) {
		right: 5px;
	}

    /* --- Header --- */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
        gap: 1rem;
        background: var(--sl-color-neutral-0);
        padding: 0.5rem 1rem;
        border-radius: 1rem;
        border: 1px solid var(--sl-color-neutral-200);
        box-shadow: 0 4px 20px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
        flex-wrap: wrap;
        color: var(--sl-color-neutral-900);
	}

    :host-context(.sl-theme-dark) .header {
        background: var(--sl-color-neutral-800);
        border-color: var(--sl-color-neutral-700);
        color: var(--sl-color-neutral-100);
        box-shadow: 0 4px 20px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .toolbar-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding-right: 1.5rem;
        border-right: 1px solid var(--sl-color-neutral-200);
    }

    :host-context(.sl-theme-dark) .toolbar-group {
        border-right-color: var(--sl-color-neutral-800);
    }

    .toolbar-group:last-child {
        border-right: none;
        padding-right: 0;
    }

    .snapshot-controls {
        /* Deprecated class, kept for safety but styles moved to toolbar-group */
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .bulk-progress-inline {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 260px;
        max-width: 420px;
    }
    .bulk-progress-inline .bulk-row { gap: 0.4rem; font-size: 0.85rem; }
    .bulk-progress-inline .bulk-bar { height: 4px; }
    
    .loads-available {
        color: var(--sl-color-neutral-500);
        font-size: 0.9rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    
    .loads-available sl-icon {
        color: var(--sl-color-warning-500);
    }
    
    .loads-available__value {
        color: var(--sl-color-neutral-700);
        font-weight: 700;
    }

    :host-context(.sl-theme-dark) .loads-available__value {
        color: var(--sl-color-neutral-200);
    }

	.btn-load-items {
        transition: all 0.2s ease;
    }
	.btn-load-items:not([disabled]):hover {
		transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	}

    /* --- Messages --- */
    .messages {
        min-height: 0;
        padding: 0 0.25rem;
    }

    .msg {
        text-align: center;
        margin: 0;
        font-size: 0.9rem;
            color: var(--sl-color-neutral-600);
            padding: 0.15rem;
    }

    .bulk-progress {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.375rem 0.5rem;
        margin-bottom: 0.125rem;
    }
    .bulk-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--sl-color-neutral-700);
    }
	.bulk-bar {
		margin-top: 0.25rem;
		height: 6px;
		border-radius: 99px;
		background: var(--sl-color-neutral-100);
		overflow: hidden;
	}
	.bulk-fill {
		height: 100%;
		background: var(--sl-color-primary-600);
		width: 0%;
		transition: width 0.2s ease;
	}

	e-stash-tab-container {
		display: block;
		margin-inline: auto;
	}

	/* --- Wealth History Section (Dashboard) --- */
	.wealth-history {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
		animation: fade-in 0.4s ease-out;
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

    /* New Compact Metrics Grid */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.5rem;
    }

    .metric-card {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.75rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .metric-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        border-color: var(--sl-color-primary-200);
    }

    .metric-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sl-color-neutral-500);
        font-weight: 600;
        margin-bottom: 0.35rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }
    
    .metric-label sl-icon {
        color: var(--sl-color-primary-500);
        font-size: 0.85rem;
    }

    .metric-value {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--sl-color-neutral-900);
        line-height: 1.1;
    }

    .metric-sub {
        font-size: 0.75rem;
        color: var(--sl-color-neutral-500);
        margin-top: 0.35rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .metric-timestamp {
        font-size: 0.65rem;
        color: var(--sl-color-neutral-400);
        margin-top: 0.2rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-variant-numeric: tabular-nums;
    }

    .metric-timestamp sl-icon {
        font-size: 0.7rem;
    }

    /* Top Movers Strip */
    .movers-strip {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: linear-gradient(135deg, var(--sl-color-neutral-0) 0%, var(--sl-color-neutral-50) 100%);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.65rem 0.85rem;
        font-size: 0.9rem;
        overflow-x: auto;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .movers-label {
        font-weight: 700;
        color: var(--sl-color-neutral-600);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding-right: 0.85rem;
        border-right: 2px solid var(--sl-color-neutral-300);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    
    .movers-label::before {
        content: "📊";
        font-size: 1rem;
    }
    
    .mover-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
        padding: 0.3rem 0.6rem;
        background: var(--sl-color-neutral-0);
        border-radius: 0.4rem;
        border: 1px solid var(--sl-color-neutral-200);
        transition: all 0.2s ease;
    }
    
    .mover-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        border-color: var(--sl-color-primary-300);
    }
    
    .mover-name {
        color: var(--sl-color-neutral-700);
        font-weight: 600;
        font-size: 0.85rem;
    }
    
    .mover-val {
        font-weight: 700;
        font-feature-settings: "tnum";
        font-size: 0.95rem;
        padding: 0.15rem 0.5rem;
        border-radius: 0.375rem;
        background: rgba(0,0,0,0.03);
    }

	.trend-up { color: var(--sl-color-success-600); background: var(--sl-color-success-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-down { color: var(--sl-color-danger-600); background: var(--sl-color-danger-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-neutral { color: var(--sl-color-neutral-500); }
    .positive { color: var(--sl-color-success-600); }
    .negative { color: var(--sl-color-danger-600); }

    .wealth-history.loading .skeleton-title,
    .wealth-history.loading .skeleton-value,
    .wealth-history.loading .skeleton-sub {
        background: var(--sl-color-neutral-100);
        border-radius: 6px;
        animation: pulse 1.4s ease-in-out infinite;
    }

    .wealth-history.loading .skeleton-title { height: 12px; }
    .wealth-history.loading .skeleton-value { height: 24px; margin-top: 8px; }
    .wealth-history.loading .skeleton-sub { height: 12px; margin-top: 8px; width: 60%; }

    .wealth-history.loading .skeleton-chart {
        height: 280px;
        background: var(--sl-color-neutral-50);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.75rem;
    }

    @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

	/* Wealth Content Grid - Chart + Categories Side by Side */
	.wealth-content-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	@container (min-width: 900px) {
		.wealth-content-grid {
			grid-template-columns: 2fr 1fr;
		}
	}

    .chart-container {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.75rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        position: relative;
    }
    
    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .chart-title {
        font-weight: 600;
        color: var(--sl-color-neutral-700);
        font-size: 0.85rem;
    }
    
    .chart-controls {
        display: flex;
        gap: 0.5rem;
    }

	canvas#wealth-line {
		display: block;
		width: 100%;
        height: 220px;
        cursor: crosshair;
	}
	
	/* Category Breakdown Panel */
	.category-breakdown-panel {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		padding: 0.75rem;
		box-shadow: 0 1px 2px rgba(0,0,0,0.05);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		color: var(--sl-color-neutral-700);
		font-size: 0.85rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--sl-color-neutral-200);
	}
	
	.panel-header sl-icon {
		color: var(--sl-color-primary-500);
		font-size: 1rem;
	}
	
	/* Compact Category List */
	.category-compact-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.cat-compact-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.cat-compact-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.cat-compact-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--sl-color-neutral-700);
	}
	
	.cat-compact-value {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--sl-color-neutral-900);
		font-variant-numeric: tabular-nums;
	}
	
	.cat-compact-bar-bg {
		position: relative;
		height: 20px;
		background: var(--sl-color-neutral-100);
		border-radius: 4px;
		overflow: hidden;
	}
	
	.cat-compact-bar {
		height: 100%;
		transition: width 0.3s ease;
		border-radius: 4px;
	}
	
	.cat-compact-percent {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--sl-color-neutral-700);
		text-shadow: 0 0 4px rgba(255,255,255,0.8);
	}

    .chart-tooltip {
        position: absolute;
        background: rgba(20, 20, 25, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.75rem;
        padding: 1rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        z-index: 100;
        font-size: 0.85rem;
        min-width: 220px;
        backdrop-filter: blur(12px);
        color: #fff;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 0.25rem;
    }

    .tooltip-date {
        color: var(--sl-color-neutral-400);
        font-size: 0.75rem;
        font-weight: 500;
    }

    .tooltip-change {
        font-weight: 600;
        font-size: 0.75rem;
        padding: 0.1rem 0.3rem;
        border-radius: 0.25rem;
    }
    .tooltip-change.positive { color: var(--sl-color-success-400); background: rgba(var(--sl-color-success-500), 0.1); }
    .tooltip-change.negative { color: var(--sl-color-danger-400); background: rgba(var(--sl-color-danger-500), 0.1); }

    .tooltip-main-value {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .tooltip-main-value .value {
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.1;
        background: linear-gradient(to right, #fff, #ccc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .tooltip-main-value .unit {
        font-size: 0.75rem;
        color: var(--sl-color-neutral-500);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .tooltip-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        background: rgba(255, 255, 255, 0.03);
        padding: 0.5rem;
        border-radius: 0.5rem;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
    }

    .stat-item .label {
        font-size: 0.7rem;
        color: var(--sl-color-neutral-500);
    }

    .stat-item .val {
        font-weight: 600;
        color: var(--sl-color-neutral-200);
    }

    .tooltip-categories {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .cat-row {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .cat-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
    }

    .cat-name { color: var(--sl-color-neutral-400); }
    .cat-val { color: var(--sl-color-neutral-200); font-weight: 500; }

    .cat-bar-bg {
        height: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
    }

    .cat-bar {
        height: 100%;
        background: var(--sl-color-primary-500);
        border-radius: 2px;
    }

	.category-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.category-list.size-large {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}

	.category-list.size-medium {
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
	}

	.category-list.size-compact {
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.category-card {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		padding: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		transition: border-color 0.2s ease;
	}

	.category-list.size-large .category-card {
		padding: 1rem;
	}

	.category-list.size-compact .category-card {
		padding: 0.5rem;
		gap: 0.5rem;
	}
    
    .category-card:hover {
        border-color: var(--sl-color-primary-300);
    }

	.category-icon {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--sl-color-primary-50);
		color: var(--sl-color-primary-600);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.category-list.size-large .category-icon {
		width: 44px;
		height: 44px;
		font-size: 1.4rem;
	}

	.category-list.size-compact .category-icon {
		width: 28px;
		height: 28px;
		font-size: 1rem;
	}

	.category-details {
		flex: 1;
        min-width: 0; /* Prevent overflow */
	}

	.category-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.25rem;
	}

	.cat-name {
		font-weight: 600;
		color: var(--sl-color-neutral-700);
		text-transform: capitalize;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.9rem;
	}

	.cat-val {
		font-weight: 700;
		color: var(--sl-color-neutral-900);
		font-feature-settings: "tnum";
		font-size: 0.9rem;
	}

	.category-list.size-large .cat-name,
	.category-list.size-large .cat-val {
		font-size: 1rem;
	}

	.category-list.size-compact .cat-name,
	.category-list.size-compact .cat-val {
		font-size: 0.85rem;
	}
    
    .category-pct {
        color: var(--sl-color-neutral-400);
        font-weight: 400;
        font-size: 0.8em;
    }

	.progress-bar {
		height: 4px;
		background: var(--sl-color-neutral-100);
		border-radius: 99px;
		overflow: hidden;
	}

	.category-list.size-large .progress-bar {
		height: 5px;
	}

	.category-list.size-compact .progress-bar {
		height: 3px;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--sl-color-primary-500), var(--sl-color-primary-400));
		border-radius: 99px;
	}

    /* Price Changes Section */
    .price-changes-section {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.75rem;
        padding: 1rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .section-title {
        font-weight: 600;
        color: var(--sl-color-neutral-700);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .section-title sl-icon {
        color: var(--sl-color-primary-500);
    }
    
    .section-title sl-badge {
        font-size: 0.7rem;
    }

    .price-changes-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        color: var(--sl-color-neutral-500);
        gap: 0.5rem;
    }
    
    .price-changes-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem;
        background: var(--sl-color-neutral-50);
        border-radius: 0.5rem;
        border: 1px dashed var(--sl-color-neutral-300);
        color: var(--sl-color-neutral-600);
        font-size: 0.9rem;
    }
    
    .price-changes-preview sl-icon {
        font-size: 1.5rem;
        color: var(--sl-color-primary-500);
    }
    
    .price-changes-preview p {
        margin: 0;
    }

    .price-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .price-stat {
        background: var(--sl-color-neutral-50);
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid var(--sl-color-neutral-200);
    }

    .price-stat.positive {
        background: var(--sl-color-success-50);
        border-color: var(--sl-color-success-200);
    }

    .price-stat.negative {
        background: var(--sl-color-danger-50);
        border-color: var(--sl-color-danger-200);
    }

    .stat-label {
        font-size: 0.75rem;
        color: var(--sl-color-neutral-500);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .price-stat.positive .stat-label { color: var(--sl-color-success-700); }
    .price-stat.negative .stat-label { color: var(--sl-color-danger-700); }

    .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--sl-color-neutral-900);
    }

    .price-stat.positive .stat-value { color: var(--sl-color-success-700); }
    .price-stat.negative .stat-value { color: var(--sl-color-danger-700); }

    .stat-desc {
        font-size: 0.75rem;
        color: var(--sl-color-neutral-500);
        margin-top: 0.25rem;
    }

    .price-tables {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .price-table-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .price-table-title {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .price-table-title.positive { color: var(--sl-color-success-600); }
    .price-table-title.negative { color: var(--sl-color-danger-600); }

    .price-table {
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        overflow: hidden;
        font-size: 0.8rem;
    }

    .price-table-header {
        display: grid;
        grid-template-columns: 2fr 0.5fr 1fr 1fr 1fr 1fr;
        background: var(--sl-color-neutral-50);
        padding: 0.5rem;
        font-weight: 600;
        color: var(--sl-color-neutral-600);
        border-bottom: 1px solid var(--sl-color-neutral-200);
        gap: 0.5rem;
    }

    .price-table-row {
        display: grid;
        grid-template-columns: 2fr 0.5fr 1fr 1fr 1fr 1fr;
        padding: 0.5rem;
        border-bottom: 1px solid var(--sl-color-neutral-100);
        align-items: center;
        gap: 0.5rem;
    }

    .price-table-row:last-child {
        border-bottom: none;
    }

    .item-name {
        font-weight: 500;
        color: var(--sl-color-neutral-700);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        flex-direction: column;
    }

    .item-category {
        font-size: 0.65rem;
        color: var(--sl-color-neutral-400);
        font-weight: 400;
    }

    .current-price, .price-change, .total-impact {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }

    .positive { color: var(--sl-color-success-600); }
    .negative { color: var(--sl-color-danger-600); }
`;
