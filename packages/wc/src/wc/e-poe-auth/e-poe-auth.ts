import { html, css, LitElement, TemplateResult, CSSResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/menu/menu.js';
import '@shoelace-style/shoelace/dist/components/menu-item/menu-item.js';
import '@shoelace-style/shoelace/dist/components/avatar/avatar.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { Events, LoginClickEvent, LogoutClickEvent } from './events.js';
import { DefineComponent } from 'vue';
import { VueEventHandlers } from '../../event-utils.js';

export type PoeAuthProps = {
	auth: AuthState;

	/**
	 * The button's size.
	 */
	size?: ButtonSize;
};

export type AuthState = { loggedIn: true; username: string } | { loggedIn: false };
export type ButtonSize = 'small' | 'medium' | 'large';

@customElement('e-poe-auth')
export class PoeAuthElement extends LitElement {
	static override styles: Array<CSSResult> = [styles()];

	@property({ type: Object }) auth: AuthState = { loggedIn: false };

	/** The button's size. */
	@property()
	size: ButtonSize = 'small';

	protected override render(): TemplateResult {
		return html`<div class="poe-auth">
			${this.auth.loggedIn
				? html`
					<sl-dropdown>
						<div slot="trigger" class="profile-trigger">
							<sl-avatar 
								image="" 
								label=${this.auth.username || 'User'} 
								initials=${(this.auth.username || '??').substring(0, 2).toUpperCase()}
								style="--size: 2rem;"
							></sl-avatar>
							<span class="username">${this.name_without_hash}</span>
							<sl-icon name="chevron-down" class="chevron"></sl-icon>
						</div>
						<sl-menu>
							<sl-menu-item @click=${this.#emitLogout}>
								<sl-icon name="box-arrow-right" slot="prefix"></sl-icon>
								Logout
							</sl-menu-item>
						</sl-menu>
					</sl-dropdown>
				  `
				: html`<div>
						<sl-button variant="primary" outline .size=${this.size} @click=${this.#emitLogin}>
							<sl-icon name="person" slot="prefix"></sl-icon>
							Connect to PoE
						</sl-button>
				  </div>`}
		</div>`;
	}

	/** Get the name without the hash part. */
	get name_without_hash(): string | null {
		if (!this.auth.loggedIn) return null;

		const name = this.auth.username;

		const hash_index = name.indexOf('#');
		if (hash_index === -1) return name;

		return name.slice(0, hash_index);
	}

	#emitLogin() {
		this.dispatchEvent(new LoginClickEvent());
	}

	#emitLogout() {
		console.log('logout click');
		this.dispatchEvent(new LogoutClickEvent());
	}
}

function styles() {
	return css`
		:host {
			display: block;
		}
		
		.profile-trigger {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
			padding: 0.25rem 0.5rem 0.25rem 0.25rem;
			border-radius: 99px;
			transition: background-color 0.2s ease;
			user-select: none;
			border: 1px solid transparent;
		}

		.profile-trigger:hover {
			background-color: var(--sl-color-neutral-100);
			border-color: var(--sl-color-neutral-200);
		}

		.username {
			font-weight: 600;
			font-size: 0.9rem;
			color: var(--sl-color-neutral-700);
		}

		:host-context(.sl-theme-dark) .username {
			color: var(--sl-color-neutral-200);
		}

		.chevron {
			font-size: 0.75rem;
			color: var(--sl-color-neutral-500);
		}
	`;
}

declare global {
	interface HTMLElementTagNameMap {
		'e-poe-auth': PoeAuthElement;
	}
}

declare module 'vue' {
	interface GlobalComponents {
		'e-poe-auth': DefineComponent<PoeAuthProps & VueEventHandlers<Events>>;
	}
}
