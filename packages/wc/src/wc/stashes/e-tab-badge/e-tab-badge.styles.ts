import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	.tab-badge-as-button {
		padding: 0.25rem 0.5rem;
		border-radius: 0.4rem;
		border: 1px solid;
		border-color: color-mix(in srgb, var(--badge-color) 30%, var(--sl-color-neutral-200));
		cursor: pointer;
		overflow: hidden;
		position: relative;
        transition: all 0.15s ease;
        background-color: var(--sl-color-neutral-0);
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);

		&:disabled {
			opacity: 0.6;
            cursor: not-allowed;
            filter: grayscale(1);
		}
        
		.name {
			pointer-events: none;
            font-weight: 500;
		}

		&:hover:not(:disabled) {
			background-color: color-mix(in srgb, var(--badge-color) 10%, var(--sl-color-neutral-0));
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border-color: var(--badge-color);
		}
        
        &:active:not(:disabled) {
            transform: translateY(0);
        }

		&::after {
			display: block;
			position: absolute;
			top: 1px;
			right: 1px;
			color: var(--sl-color-neutral-500);
			content: var(--tab-index);
			font-size: 0.55rem;
			line-height: 1;
			opacity: 0.7;
		}

		& .name {
			font-size: 0.85rem;
			color: var(--sl-color-neutral-700);

			& .remove-only {
				font-size: 0.7em;
                opacity: 0.7;
                vertical-align: super;
			}
		}
	}

	.tab-badge-as-checkbox {
		min-width: 5rem;
		height: 2.2rem;
		padding: 0 0.5rem;
		padding-right: 1.2rem;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 0.4rem;
		border: 1px solid var(--sl-color-neutral-300);
		background-color: var(--sl-color-neutral-0);
		position: relative;
        transition: all 0.2s ease;
        cursor: pointer;

		&:has(.checkbox:checked) {
			background-color: color-mix(in srgb, var(--badge-color) 15%, var(--sl-color-neutral-0));
            border-color: var(--badge-color);
            font-weight: 600;
		}
        
        &:hover {
            background-color: var(--sl-color-neutral-50);
        }

		.checkbox {
			position: absolute;
			appearance: none;
			inset: 0;
			cursor: pointer;
            margin: 0;
		}

		&::after {
			display: block;
			position: absolute;
			top: 1px;
			right: 2px;
			color: var(--sl-color-neutral-400);
			content: var(--tab-index);
			font-size: 0.55rem;
		}

		& .name {
			font-size: 0.85rem;
			color: var(--sl-color-neutral-700);
			z-index: 1;
			pointer-events: none;
			white-space: nowrap;

			& .remove-only {
				font-size: 0.7em;
                vertical-align: super;
			}
		}
	}

	.name {
		/* Fallback/Shared */
		color: var(--badge-color);
	}

	:host-context(e-tab-badge-group[density="ultra"]) .tab-badge-as-button {
		padding: 0.2rem 0.4rem;
		border-radius: 0.35rem;
		box-shadow: none;
	}
	:host-context(e-tab-badge-group[density="ultra"]) .tab-badge-as-checkbox {
		min-width: 4.5rem;
		height: 1.9rem;
		padding: 0 0.4rem;
		padding-right: 1rem;
		border-radius: 0.35rem;
		box-shadow: none;
	}
	:host-context(e-tab-badge-group[density="ultra"]) .tab-badge-as-button .name,
	:host-context(e-tab-badge-group[density="ultra"]) .tab-badge-as-checkbox .name {
		font-size: 0.8rem;
	}
`;
