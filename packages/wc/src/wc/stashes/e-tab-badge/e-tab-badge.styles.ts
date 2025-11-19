import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	.tab-badge-as-button {
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
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
            /* Index number */
			display: block;
			position: absolute;
			top: 2px;
			right: 2px;
			color: var(--sl-color-neutral-500);
			content: var(--tab-index);
			font-size: 0.6rem;
            line-height: 1;
            opacity: 0.7;
		}

		& .name {
			font-size: 0.9rem;
			color: var(--sl-color-neutral-700);

			& .remove-only {
				font-size: 0.7em;
                opacity: 0.7;
                vertical-align: super;
			}
		}
	}

	.tab-badge-as-checkbox {
        /* Multiselect mode */
		min-width: 6rem;
		height: 2.5rem;
        padding: 0 0.75rem;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 0.5rem;
		border: 1px solid var(--sl-color-neutral-300);
		overflow: hidden;
		background-color: var(--sl-color-neutral-0);
		position: relative;
        transition: all 0.2s ease;
        cursor: pointer;

		&:has(.checkbox:checked) {
			background-color: color-mix(in srgb, var(--badge-color) 15%, var(--sl-color-neutral-0));
            border-color: var(--badge-color);
            box-shadow: 0 0 0 1px var(--badge-color);
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
			top: 2px;
			right: 4px;
			color: var(--sl-color-neutral-400);
			content: var(--tab-index);
			font-size: 0.6rem;
		}

		& .name {
			font-size: 0.9rem;
			color: var(--sl-color-neutral-700);
            z-index: 1;
            pointer-events: none;

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
`;
