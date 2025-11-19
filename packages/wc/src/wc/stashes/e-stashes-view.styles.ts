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
        gap: 1.5rem;
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
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid var(--sl-color-neutral-200);
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        flex-wrap: wrap;
	}

    .header-left {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex: 1;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .snapshot-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: var(--sl-color-neutral-50);
        padding: 0.35rem 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid var(--sl-color-neutral-200);
    }
    
    .loads-available {
        color: var(--sl-color-neutral-500);
        font-size: 0.85rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .loads-available__value {
        color: var(--sl-color-primary-600);
        font-weight: 700;
        background: var(--sl-color-primary-50);
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
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
		min-height: 0; /* Collapse if empty */
		padding: 0 1rem;
	}

	.msg {
		text-align: center;
		margin: 0;
		font-size: 1rem;
			color: var(--sl-color-neutral-600);
			padding: 0.5rem;
	}

	.bulk-progress {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		margin-bottom: 0.5rem;
	}
	.bulk-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: 600;
		color: var(--sl-color-neutral-700);
	}
	.bulk-bar {
		margin-top: 0.5rem;
		height: 8px;
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
        gap: 1.5rem;
		animation: fade-in 0.4s ease-out;
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.wealth-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
	}

    .stats-card {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 1rem;
        padding: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        grid-column: 1 / -1; /* Full width */
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--sl-color-neutral-100);
        padding-bottom: 1rem;
    }

    .stats-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--sl-color-neutral-700);
    }

    .stats-rate {
        font-size: 1.2rem;
        font-weight: 700;
    }
    .stats-rate.positive { color: var(--sl-color-success-600); }
    .stats-rate.negative { color: var(--sl-color-danger-600); }
    .stats-rate.neutral { color: var(--sl-color-neutral-500); }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem 2rem;
    }

    .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }

    .stat-label {
        color: var(--sl-color-neutral-500);
        font-size: 0.9rem;
    }

    .stat-val {
        font-weight: 600;
        color: var(--sl-color-neutral-900);
        font-variant-numeric: tabular-nums;
    }
    .stat-val.positive { color: var(--sl-color-success-600); }
    .stat-val.negative { color: var(--sl-color-danger-600); }

	.summary-card {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 1rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        overflow: hidden;
	}

	.summary-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
        border-color: var(--sl-color-primary-200);
	}
    
    /* Decorative background icon */
    .summary-card::after {
        content: '';
        position: absolute;
        right: -10px;
        bottom: -10px;
        width: 80px;
        height: 80px;
        background: var(--sl-color-neutral-50);
        border-radius: 50%;
        z-index: 0;
    }

	.summary-label {
		font-size: 0.75rem;
		color: var(--sl-color-neutral-500);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
        font-weight: 600;
        z-index: 1;
	}
    
    .summary-label sl-icon {
        font-size: 1rem;
        color: var(--sl-color-primary-500);
    }

	.summary-value {
		font-size: 2rem;
		font-weight: 800;
		color: var(--sl-color-neutral-900);
        line-height: 1.2;
        z-index: 1;
	}

	.summary-sub {
		font-size: 0.85rem;
		color: var(--sl-color-neutral-500);
		margin-top: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        z-index: 1;
	}

	.trend-up { color: var(--sl-color-success-600); background: var(--sl-color-success-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-down { color: var(--sl-color-danger-600); background: var(--sl-color-danger-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-neutral { color: var(--sl-color-neutral-500); }

	.charts {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@container (min-width: 1000px) {
		.charts {
			grid-template-columns: 2fr 1fr;
		}
	}

    .chart-container {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 1rem;
        padding: 1.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        position: relative;
    }

	canvas#wealth-line,
	canvas#wealth-bars {
		display: block;
		width: 100%;
        height: 350px; /* Slightly taller */
        cursor: crosshair;
	}

    .chart-tooltip {
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.75rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        z-index: 20;
        font-size: 0.85rem;
        min-width: 140px;
        backdrop-filter: blur(8px);
    }

    .tooltip-date {
        color: var(--sl-color-neutral-500);
        margin-bottom: 0.5rem;
        font-weight: 600;
        border-bottom: 1px solid var(--sl-color-neutral-100);
        padding-bottom: 0.25rem;
    }

    .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.25rem;
    }

    .tooltip-label {
        color: var(--sl-color-neutral-500);
    }

    .tooltip-val {
        font-weight: 700;
        color: var(--sl-color-neutral-900);
        font-feature-settings: "tnum";
    }

	.category-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.category-card {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.75rem;
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
        transition: border-color 0.2s ease;
	}
    
    .category-card:hover {
        border-color: var(--sl-color-primary-300);
    }

	.category-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: var(--sl-color-primary-50);
		color: var(--sl-color-primary-600);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
        flex-shrink: 0;
	}

	.category-details {
		flex: 1;
        min-width: 0; /* Prevent overflow */
	}

	.category-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.5rem;
	}

	.cat-name {
		font-weight: 600;
		color: var(--sl-color-neutral-700);
		text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
	}

	.cat-val {
		font-weight: 700;
		color: var(--sl-color-neutral-900);
        font-feature-settings: "tnum";
	}
    
    .category-pct {
        color: var(--sl-color-neutral-400);
        font-weight: 400;
        font-size: 0.8em;
    }

	.progress-bar {
		height: 6px;
		background: var(--sl-color-neutral-100);
		border-radius: 99px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--sl-color-primary-500), var(--sl-color-primary-400));
		border-radius: 99px;
	}
`;
