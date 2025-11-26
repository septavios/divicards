import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	.tab-badge-as-button {
		padding: 0.5rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid transparent; /* Prepare for border transition */
        background-color: var(--card-bg);
		cursor: pointer;
		overflow: hidden;
		position: relative;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
        min-height: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        @media (prefers-color-scheme: dark) {
             background-color: var(--card-bg);
             box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
        }

		&:disabled {
			opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(1);
            box-shadow: none;
		}
        
		.name {
			pointer-events: none;
            font-weight: 600;
            letter-spacing: 0.015em;
            color: var(--sl-color-neutral-700);
            transition: color 0.2s ease;
		}

        /* Hover State */
		&:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            /* Add a subtle border color on hover based on badge color */
            border-color: color-mix(in srgb, var(--badge-color) 40%, transparent);
		}
        
        /* Active/Pressed State */
        &:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        /* Index Number Styling */
		&::after {
			display: block;
			position: absolute;
			top: 2px;
			right: 4px;
			color: var(--sl-color-neutral-400);
			content: var(--tab-index);
			font-size: 0.6rem;
			line-height: 1;
			opacity: 0.8;
            font-weight: 700;
            font-feature-settings: "tnum";
		}

		& .name {
			font-size: 0.9rem;
            /* Ensure text contrast */
            color: var(--sl-color-neutral-700);

			& .remove-only {
				font-size: 0.7em;
                opacity: 0.6;
                vertical-align: super;
                margin-left: 2px;
			}
		}
	}

    :host-context(.sl-theme-dark) .tab-badge-as-button {
        background-color: var(--card-bg);
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        
        & .name {
            color: var(--sl-color-neutral-200);
        }
        
        &::after {
            color: var(--sl-color-neutral-500);
        }
        
        &:hover:not(:disabled) {
             background-color: var(--sl-color-neutral-700);
        }
    }

	.tab-badge-as-checkbox {
		min-width: 5rem;
		height: 2.5rem;
		padding: 0 0.85rem;
		padding-right: 1.5rem;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 0.5rem;
		border: 1px solid transparent;
        background-color: var(--card-bg);
		position: relative;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);

        /* Dark mode adjustment */
        @media (prefers-color-scheme: dark) {
             background-color: var(--card-bg);
             box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
        }

		&:has(.checkbox:checked) {
			background-color: color-mix(in srgb, var(--badge-color) 15%, var(--sl-color-neutral-0));
            border-color: var(--badge-color);
            font-weight: 600;
            box-shadow: 0 0 0 1px var(--badge-color), 0 2px 4px rgba(0,0,0,0.1);
		}
        
        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            /* Add a subtle border color on hover based on badge color */
            border-color: color-mix(in srgb, var(--badge-color) 40%, transparent);
        }
        
        &:active {
             transform: translateY(0);
             box-shadow: 0 1px 2px rgba(0,0,0,0.05);
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
            font-weight: 700;
            font-feature-settings: "tnum";
            opacity: 0.8;
		}

		& .name {
			font-size: 0.9rem;
			color: var(--sl-color-neutral-700);
			z-index: 1;
			pointer-events: none;
			white-space: nowrap;
            font-weight: 600;
            letter-spacing: 0.015em;
            transition: color 0.2s ease;

			& .remove-only {
				font-size: 0.7em;
                vertical-align: super;
                margin-left: 2px;
                opacity: 0.6;
			}
		}
	}

    :host-context(.sl-theme-dark) .tab-badge-as-checkbox {
        background-color: var(--card-bg);
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        border-color: transparent;

        & .name {
            color: var(--sl-color-neutral-200);
        }
        
        &::after {
            color: var(--sl-color-neutral-500);
        }
        
        &:hover {
             background-color: var(--sl-color-neutral-700);
        }

        &:has(.checkbox:checked) {
             background-color: color-mix(in srgb, var(--badge-color) 25%, var(--sl-color-neutral-800));
             border-color: var(--badge-color);
             box-shadow: 0 0 0 1px var(--badge-color), 0 2px 4px rgba(0,0,0,0.2);
        }
    }

    .name { color: inherit; }

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
