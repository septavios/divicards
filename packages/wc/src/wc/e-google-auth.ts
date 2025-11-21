import { html, css, LitElement, CSSResult, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emit } from '../utils.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/menu/menu.js';
import '@shoelace-style/shoelace/dist/components/menu-item/menu-item.js';
import '@shoelace-style/shoelace/dist/components/avatar/avatar.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';

declare global {
	interface HTMLElementTagNameMap {
		'e-google-auth': GoogleAuthElement;
	}
}

@customElement('e-google-auth')
export class GoogleAuthElement extends LitElement {
	static override styles: Array<CSSResult> = [styles()];

	@property({ reflect: true }) name: string = '';
	@property({ reflect: true }) picture: string = '';
	@property({ type: Boolean, reflect: true }) loggedIn: boolean = false;

	protected override render(): TemplateResult {
		return html`
			<div class="auth">
				${this.loggedIn
				? html`
						<sl-dropdown>
							<div slot="trigger" class="profile-trigger">
								<sl-avatar 
									image=${this.picture} 
									label=${this.name} 
									style="--size: 2rem;"
								></sl-avatar>
								<sl-icon name="chevron-down" class="chevron"></sl-icon>
							</div>
							<sl-menu>
								<sl-menu-item disabled>
									<sl-icon name="google" slot="prefix"></sl-icon>
									${this.name}
								</sl-menu-item>
								<sl-divider></sl-divider>
								<sl-menu-item @click=${this.#emitLogout}>
									<sl-icon name="box-arrow-right" slot="prefix"></sl-icon>
									Logout
								</sl-menu-item>
							</sl-menu>
						</sl-dropdown>
					  `
				: html`
						<sl-button variant="default" size="small" @click=${this.#emitLogin}>
							<sl-icon name="google" slot="prefix"></sl-icon>
							Sign in
						</sl-button>
					  `}
			</div>
		`;
	}

	#emitLogin() {
		emit(this, 'login');
	}

	#emitLogout() {
		emit(this, 'logout');
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
			gap: 0.25rem;
			cursor: pointer;
			padding: 0.25rem;
			border-radius: 99px;
			transition: background-color 0.2s ease;
			border: 1px solid transparent;
		}

		.profile-trigger:hover {
			background-color: var(--sl-color-neutral-100);
			border-color: var(--sl-color-neutral-200);
		}

		.chevron {
			font-size: 0.75rem;
			color: var(--sl-color-neutral-500);
			margin-right: 0.25rem;
		}
	`;
}
