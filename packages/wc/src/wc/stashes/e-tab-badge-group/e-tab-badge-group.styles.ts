import { css, CSSResult } from 'lit';

export const styles: CSSResult = css`
	:host {
		display: block;
        margin-bottom: 1rem;
	}
	.tab-badge-group {
		display: flex;
        flex-direction: column;
		gap: 1.5rem;
        background: var(--sl-color-neutral-0);
        border: 1px solid var(--sl-color-neutral-200);
        border-radius: 1rem;
        padding: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
	}

	.header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--sl-color-neutral-100);

		& .header__left {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 1rem;
			flex-grow: 1;

			& sl-input {
				width: 200px;
			}
		}

		.header__right {
			display: flex;
			align-items: center;
			gap: 1rem;
		}
	}

	.tabs-total__count {
		color: var(--sl-color-primary-600);
        font-weight: 700;
        background: var(--sl-color-primary-50);
        padding: 0.1rem 0.5rem;
        border-radius: 99px;
        font-size: 0.9em;
	}

    .list {
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        gap: 0.75rem;
        margin: 0;
        padding: 0;
    }

	li {
		display: contents; /* Let children participate in flex layout */
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
`;
