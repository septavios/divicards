import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	:host {
		display: block;
		margin-bottom: 1rem;
	}

    .tab-badge-group {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        /* Removed background/border for a cleaner look, relying on the badges themselves */
        padding: 0.25rem;
    }

    :host-context(.sl-theme-dark) .tab-badge-group {
        /* No specific overrides needed if we remove the container box */
    }

	/* Compact Header */
    .header-compact {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem;
        background: var(--sl-color-neutral-50);
        border-bottom: 1px solid var(--sl-color-neutral-200);
        border-radius: 0.5rem 0.5rem 0 0;
    }

    :host-context(.sl-theme-dark) .header-compact {
        background: var(--sl-color-neutral-800);
        border-bottom-color: var(--sl-color-neutral-700);
    }

	.header-left, .header-center, .header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

    .header-left { flex-grow: 1; }
    .header-center { justify-content: center; }
    .header-right { justify-content: flex-end; }

	.stats-badge {
		font-size: 0.85rem;
		color: var(--sl-color-neutral-600);
        font-weight: 500;
	}

    :host-context(.sl-theme-dark) .stats-badge {
        color: var(--sl-color-neutral-400);
    }

	.tab-count {
		font-size: 0.85rem;
		color: var(--sl-color-primary-600);
        font-weight: 600;
	}
    
    .page-info {
        font-size: 0.9rem;
        color: var(--sl-color-neutral-700);
        min-width: 60px;
        text-align: center;
    }

    :host-context(.sl-theme-dark) .page-info {
        color: var(--sl-color-neutral-300);
    }

    /* Multiselect Group */
    .multiselect-group {
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
        padding: 0.2rem 0.5rem; 
        border-radius: 0.25rem;
        transition: background-color 0.2s ease;
    }

    .multiselect-group.active {
        background: var(--sl-color-neutral-200);
    }

    :host-context(.sl-theme-dark) .multiselect-group.active {
        background: var(--sl-color-neutral-700);
    }

    .multiselect-action {
        color: var(--sl-color-neutral-600);
    }
    
    .multiselect-action:hover {
        color: var(--sl-color-primary-600);
    }

    :host-context(.sl-theme-dark) .multiselect-action {
        color: var(--sl-color-neutral-300);
    }

    :host-context(.sl-theme-dark) .multiselect-action:hover {
        color: var(--sl-color-primary-400);
    }

    /* List container */
    .list-compact {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.4rem;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    /* Virtualized list container */
    .list-virtual {
        height: 55vh;
        min-height: 240px;
        border-radius: 0.5rem;
        border: var(--card-border);
        background: var(--card-bg);
    }

    :host([density="cozy"]) .list-compact {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.5rem;
    }

    :host([density="comfortable"]) .list-compact {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.6rem;
    }

    :host([density="dense"]) .list-compact {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.3rem;
    }

    :host([density="ultra"]) .list-compact {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.2rem;
    }

    :host([density="ultra"]) .tab-badge-group {
        gap: 0.3rem;
        padding: 0.2rem;
        border-radius: 0.35rem;
        box-shadow: none;
    }

	li {
		display: block;
	}

	.hovered-error {
        /* Handled by child badge usually, but if wrapper needs it: */
        position: relative;
	}
    
    .hovered-error::after {
        content: '';
        position: absolute;
        inset: -4px;
        border: 2px solid var(--sl-color-danger-500);
        border-radius: 0.5rem;
        pointer-events: none;
    }

    /* Selection Controls */
    .selection-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem;
        background: var(--card-bg);
        border-radius: 0.375rem;
        border: var(--card-border);
    }

    :host-context(.sl-theme-dark) .selection-controls {
        background: var(--card-bg);
        border: var(--card-border);
    }

    .selection-controls sl-button::part(base) {
        font-weight: 500;
        transition: all 0.2s ease;
        min-width: 110px;
        height: 32px;
    }

    .selection-controls sl-button[variant="default"]::part(base) {
        background: var(--sl-color-neutral-0);
        border-color: var(--sl-color-neutral-300);
    }

    .selection-controls sl-button[variant="default"]:hover::part(base) {
        background: var(--sl-color-primary-50);
        border-color: var(--sl-color-primary-300);
        color: var(--sl-color-primary-700);
    }

    :host-context(.sl-theme-dark) .selection-controls sl-button[variant="default"]::part(base) {
        background: var(--sl-color-neutral-800);
        border-color: var(--sl-color-neutral-600);
        color: var(--sl-color-neutral-200);
    }

    :host-context(.sl-theme-dark) .selection-controls sl-button[variant="default"]:hover::part(base) {
        background: var(--sl-color-primary-900);
        border-color: var(--sl-color-primary-600);
        color: var(--sl-color-primary-300);
    }

    .selection-controls sl-button[disabled]::part(base) {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Improve header layout */
    .header-left {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    /* Recent section */
    .recent-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
    }
    .recent-section .section-title {
        font-weight: 600;
        color: var(--sl-color-neutral-700);
    }
    :host-context(.sl-theme-dark) .recent-section .section-title { color: var(--sl-color-neutral-300); }
    .recent-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }

    /* Group sections */
    .group-sections { display: flex; flex-direction: column; gap: 0.75rem; }
    .group-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .group-section .section-title { font-weight: 600; color: var(--sl-color-neutral-700); }
    :host-context(.sl-theme-dark) .group-section .section-title { color: var(--sl-color-neutral-300); }
    .group-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
`;
