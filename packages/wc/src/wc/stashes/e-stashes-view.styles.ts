import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	:host {
		display: block;
		max-width: 1500px;
		background-color: var(--sl-color-neutral-0);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--sl-color-neutral-1000, black) 6%, transparent),
			0 4px 12px color-mix(in srgb, var(--sl-color-neutral-1000, black) 8%, transparent);
	}

	.main-stashes-component {
		position: relative;
		border-radius: 0.25rem;
		padding-inline: 1rem;
	}

	wc-help-tip::part(tooltip) {
		right: 5px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;

		& e-league-select {
			margin-top: 1rem;
		}

		& .loads-available {
			color: var(--sl-color-neutral-600);
            font-size: 0.9rem;
            white-space: nowrap;
		}

		& .loads-available__value {
			color: var(--sl-color-neutral-700);
            font-weight: 600;
		}
	}

    .header-left {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .snapshot-controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: var(--sl-color-neutral-50);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        border: 1px solid var(--sl-color-neutral-200);
    }

	.btn-load-items:not([disabled]) {
		transform: scale(1.2);
	}

	.messages {
		min-height: 2rem;
	}

	.msg {
		max-width: max-content;
		margin-inline: auto;
		margin-block: 0;
		font-size: 20px;
	}

	e-stash-tab-container {
		display: block;
		margin-inline: auto;
	}

	/* Wealth History Section */
	.wealth-history {
		margin-block: 1rem;
		padding: 1.5rem;
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.75rem;
		background-color: var(--sl-color-neutral-50);
		animation: fade-in 0.3s ease-in-out;
	}

	@keyframes fade-in {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.wealth-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.summary-card {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		box-shadow: 0 1px 3px rgba(0,0,0,0.05);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.summary-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px rgba(0,0,0,0.05);
	}

	.summary-label {
		font-size: 0.875rem;
		color: var(--sl-color-neutral-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.summary-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--sl-color-neutral-900);
	}

	.summary-sub {
		font-size: 0.875rem;
		color: var(--sl-color-neutral-500);
		margin-top: 0.25rem;
	}

	.trend-up { color: var(--sl-color-success-600); }
	.trend-down { color: var(--sl-color-danger-600); }
	.trend-neutral { color: var(--sl-color-neutral-500); }

	.charts {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	@container (min-width: 900px) {
		.charts {
			grid-template-columns: 2fr 1fr;
		}
	}

	canvas#wealth-line,
	canvas#wealth-bars {
		display: block;
		width: 100%;
        height: 300px;
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		background-color: var(--sl-color-neutral-0);
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        cursor: crosshair;
	}

    .chart-tooltip {
        position: absolute;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.25rem;
        padding: 0.5rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        pointer-events: none;
        z-index: 10;
        font-size: 0.8rem;
        min-width: 120px;
        backdrop-filter: blur(4px);
    }

    .tooltip-date {
        color: var(--sl-color-neutral-500);
        margin-bottom: 0.25rem;
        font-weight: 600;
        border-bottom: 1px solid var(--sl-color-neutral-200);
        padding-bottom: 0.25rem;
    }

    .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
    }

    .tooltip-label {
        color: var(--sl-color-neutral-600);
    }

    .tooltip-val {
        font-weight: 700;
        color: var(--sl-color-neutral-900);
    }

	.category-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1rem;
	}

	.category-card {
		background: var(--sl-color-neutral-0);
		border: 1px solid var(--sl-color-neutral-200);
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.category-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--sl-color-primary-100);
		color: var(--sl-color-primary-600);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
	}

	.category-details {
		flex: 1;
	}

	.category-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.25rem;
	}

	.cat-name {
		font-weight: 600;
		color: var(--sl-color-neutral-800);
		text-transform: capitalize;
	}

	.cat-val {
		font-weight: 700;
		color: var(--sl-color-neutral-900);
	}

	.progress-bar {
		height: 6px;
		background: var(--sl-color-neutral-100);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--sl-color-primary-500);
		border-radius: 3px;
	}
`;
