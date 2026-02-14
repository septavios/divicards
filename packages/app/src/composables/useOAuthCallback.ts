import { onMounted } from 'vue';
import { resolveBaseUrl } from '../command';
import { toast } from '../toast';
import { useAuthStore } from '../stores/auth';

type AuthStore = ReturnType<typeof useAuthStore>;

export const useOAuthCallback = (authStore: AuthStore) => {
	const clearOAuthState = () => {
		localStorage.removeItem('oauth_state');
		localStorage.removeItem('pkce_verifier');
		sessionStorage.removeItem('last_auth_code');
	};

	const completeOAuthFlow = (redirectToRoot: boolean = false) => {
		clearOAuthState();
		const nextPath = redirectToRoot ? '/' : window.location.pathname;
		window.history.replaceState({}, document.title, nextPath);
	};

	const failOAuthFlow = (message: string) => {
		toast('danger', message);
		completeOAuthFlow();
	};

	onMounted(async () => {
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');
		const state = params.get('state');
		const error = params.get('error');

		if (error) {
			failOAuthFlow(`Authorization failed: ${error}`);
			return;
		}

		if (code && state) {
			const lastCode = sessionStorage.getItem('last_auth_code');
			if (lastCode === code) {
				console.log('Auth code already processed, skipping.');
				completeOAuthFlow();
				return;
			}
			sessionStorage.setItem('last_auth_code', code);

			const storedState = localStorage.getItem('oauth_state');
			const verifier = localStorage.getItem('pkce_verifier');

			if (state !== storedState) {
				failOAuthFlow('Authorization failed: state mismatch');
				return;
			}

			if (!verifier) {
				failOAuthFlow('Authorization failed: missing PKCE verifier');
				return;
			}

			try {
				const baseUrl = resolveBaseUrl();
				const redirectUri = `${window.location.origin}/callback`;
				const response = await fetch(`${baseUrl}/poe/token`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						code: code,
						redirect_uri: redirectUri,
						code_verifier: verifier,
					}),
				});

				if (!response.ok) {
					const text = await response.text();
					let errMessage = text;
					try {
						const parsed = JSON.parse(text);
						errMessage = parsed.error_description || parsed.error || text;
					} catch {}
					throw new Error(errMessage || 'Unknown error');
				}

				const data = await response.json();
				localStorage.setItem('access_token', data.access_token);
				completeOAuthFlow(true);

				toast('success', 'Successfully logged in!');
				authStore.setWebLogin('Logged In');
			} catch (e: any) {
				console.error('Token Error:', e);
				failOAuthFlow(`Token exchange failed: ${e.message}`);
			}
		}
	});
};
