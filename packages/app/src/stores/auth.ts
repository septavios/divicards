import { defineStore } from 'pinia';
import { command } from '../command';
import { ref, watch, Ref, computed } from 'vue';
import { addRustListener } from '../event';
import { useLocalStorage } from '@vueuse/core';

const TEN_HOURS_AS_MILLIS = 10 * 3600 * 1000;
const EXPIRES_IN_MILLIS = TEN_HOURS_AS_MILLIS;
const POE_NAME_KEY = 'poe-name';

export const useExpirationDate = (log = false) => {
	const EXPIRATION_KEY = 'auth-expiration';
	const item = localStorage.getItem(EXPIRATION_KEY);
	const fromStorage = item ? new Date(item) : null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let timeLeftInterval: ReturnType<typeof setInterval> | null = null;

	const expirationDate = ref<Date | null>(fromStorage);
	const loggedIn = computed(() => {
		if (expirationDate.value === null) return false;
		return new Date().getTime() < expirationDate.value.getTime();
	});

	const setExpiration = (expiresInMillis: number = EXPIRES_IN_MILLIS, date = new Date()) => {
		expirationDate.value = new Date(date.getTime() + expiresInMillis);
	};

	const timeLeft = ref(0);

	const manageTimers = (date: Date | null) => {
		if (date == null) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			if (timeLeftInterval) {
				timeLeft.value = 0;
				clearInterval(timeLeftInterval);
			}
		} else if (date instanceof Date) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}

			const left = date.getTime() - new Date().getTime();
			if (log) {
				timeLeft.value = Math.floor(left / 1000);
				timeLeftInterval = setInterval(() => {
					if (timeLeft.value <= 0) {
						clearInterval(timeLeftInterval!);
					}
					timeLeft.value -= 1;
				}, 1000);
			}
			timer = setTimeout(() => {
				expirationDate.value = null;
			}, left);
		}
	};

	watch(
		() => expirationDate.value,
		(date: Date | null) => {
			manageTimers(date);
			if (date == null) {
				localStorage.setItem(EXPIRATION_KEY, JSON.stringify(null));
			} else if (date instanceof Date) {
				localStorage.setItem(EXPIRATION_KEY, date.toJSON());
			} else console.warn('erroneus type');
		}
	);

	manageTimers(expirationDate.value);

	return { expirationDate, loggedIn, setExpiration, timeLeft, log };
};

const { expirationDate, loggedIn, setExpiration, timeLeft, log } = useExpirationDate();

export const useAuthStore = defineStore('auth', {
	state: (): {
		name: Ref<string>;
		expiration: Ref<Date | null>;
		loggingIn: boolean;
		auth_url: string | null;
	} => ({
		name: useLocalStorage(POE_NAME_KEY, ''),
		expiration: expirationDate,
		loggingIn: false,
		auth_url: null,
	}),

	getters: {
		timeLeft(): number {
			return timeLeft.value;
		},
		loggedIn(): boolean {
			return loggedIn.value;
		},
		log() {
			return log;
		},
	},
	actions: {
		async init(): Promise<void> {
			if (this.loggedIn) {
				setExpiration(EXPIRES_IN_MILLIS);
			}
		},
		async login(): Promise<void> {
			if (this.loggingIn) {
				console.log('Already logging in');
				if (!this.auth_url) return;
				await command('open_url', { url: this.auth_url });
				return;
			}
			if (this.loggedIn) {
				console.log('Already logged in');
				return;
			}

			this.loggingIn = true;

			let biometricOk = false;
			try {
				await command('biometric_authenticate');
				biometricOk = true;
			} catch (err: any) {
				const isTauri = typeof err === 'object' && err !== null && 'appErrorFromTauri' in err;
				if (isTauri && err.kind === 'authError') {
					if (err.authError === 'userDenied') {
						this.loggingIn = false;
						return;
					}
					// Non-user-denied error: treat as unavailable and proceed with fallback
					console.warn('Biometric unavailable, falling back to OAuth:', err);
				} else {
					console.warn('Biometric error, falling back to OAuth:', err);
				}
			}

			const unlisten = await addRustListener('auth-url', e => {
				this.auth_url = e.payload.url;
			});

			try {
				// Gate OAuth behind biometric success or explicit fallback
				this.name = await command('poe_auth');
				setExpiration(EXPIRES_IN_MILLIS);
			} finally {
				this.loggingIn = false;
				this.auth_url = null;
				unlisten();
			}
		},

		async logout(): Promise<void> {
			await command('poe_logout');
			this.expiration = null;
		},
	},
});
