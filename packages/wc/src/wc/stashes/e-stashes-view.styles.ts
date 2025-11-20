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
        gap: 1rem;
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
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        border: 1px solid var(--sl-color-neutral-200);
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        flex-wrap: wrap;
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
        gap: 0.75rem;
    }

    .snapshot-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--sl-color-neutral-50);
        padding: 0.25rem 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid var(--sl-color-neutral-200);
    }
    
    .loads-available {
        color: var(--sl-color-neutral-500);
        font-size: 0.8rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    
    .loads-available__value {
        color: var(--sl-color-primary-600);
        font-weight: 700;
        background: var(--sl-color-primary-50);
        padding: 0.1rem 0.3rem;
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
		padding: 0 0.5rem;
	}

	.msg {
		text-align: center;
		margin: 0;
		font-size: 0.9rem;
			color: var(--sl-color-neutral-600);
			padding: 0.25rem;
	}

	.bulk-progress {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.25rem;
	}
	.bulk-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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
        gap: 1rem;
		animation: fade-in 0.4s ease-out;
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

    /* New Compact Metrics Grid */
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .metric-card {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.75rem;
        padding: 1rem;
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
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sl-color-neutral-500);
        font-weight: 600;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    
    .metric-label sl-icon {
        color: var(--sl-color-primary-500);
    }

    .metric-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--sl-color-neutral-900);
        line-height: 1.1;
    }

    .metric-sub {
        font-size: 0.8rem;
        color: var(--sl-color-neutral-500);
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    /* Top Movers Strip */
    .movers-strip {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        overflow-x: auto;
    }
    
    .movers-label {
        font-weight: 600;
        color: var(--sl-color-neutral-500);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding-right: 1rem;
        border-right: 1px solid var(--sl-color-neutral-200);
        white-space: nowrap;
    }
    
    .mover-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
    }
    
    .mover-name {
        color: var(--sl-color-neutral-700);
        font-weight: 500;
    }
    
    .mover-val {
        font-weight: 600;
        font-feature-settings: "tnum";
    }

	.trend-up { color: var(--sl-color-success-600); background: var(--sl-color-success-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-down { color: var(--sl-color-danger-600); background: var(--sl-color-danger-50); padding: 0.1rem 0.4rem; border-radius: 99px; display: inline-block; font-weight: 600; }
	.trend-neutral { color: var(--sl-color-neutral-500); }
    .positive { color: var(--sl-color-success-600); }
    .negative { color: var(--sl-color-danger-600); }

	.charts {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@container (min-width: 1000px) {
		.charts {
			grid-template-columns: 2fr 1fr;
		}
	}

    .chart-container {
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.75rem;
        padding: 1rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        position: relative;
    }
    
    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }
    
    .chart-title {
        font-weight: 600;
        color: var(--sl-color-neutral-700);
        font-size: 0.9rem;
    }

	canvas#wealth-line,
	canvas#wealth-bars {
		display: block;
		width: 100%;
        height: 280px; /* Reduced height */
        cursor: crosshair;
	}

    .chart-tooltip {
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        z-index: 20;
        font-size: 0.8rem;
        min-width: 120px;
        backdrop-filter: blur(8px);
    }

    .tooltip-date {
        color: var(--sl-color-neutral-500);
        margin-bottom: 0.25rem;
        font-weight: 600;
        border-bottom: 1px solid var(--sl-color-neutral-100);
        padding-bottom: 0.25rem;
    }

    .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.1rem;
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
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
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

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--sl-color-primary-500), var(--sl-color-primary-400));
		border-radius: 99px;
	}
`;
