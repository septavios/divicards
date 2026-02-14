import { computed, nextTick, Ref, ref, shallowRef } from 'vue';
import { StashLoader } from '../StashLoader';
import { command } from '../command';
import { DivinationCardsSample, isTradeLeague, League } from '@divicards/shared/types.js';
import { ACTIVE_LEAGUE } from '@divicards/shared/lib.js';
import { TabWithItems } from 'poe-custom-elements/types.js';
import { ExtractCardsEvent, StashtabFetchedEvent } from '@divicards/wc/stashes/events.js';

type AuthStore = {
	loggedIn: boolean;
	login: () => Promise<void>;
};

type SampleStore = {
	addSample: (name: string, sample: DivinationCardsSample, league: League) => Promise<void> | void;
};

export const useStashState = (options: {
	authStore: AuthStore;
	sampleStore: SampleStore;
	handleError: (err: unknown) => void;
	toast: (variant: 'neutral' | 'success' | 'warning' | 'danger', message: string) => void;
}) => {
	const { authStore, sampleStore, handleError, toast } = options;

	const stashLoader = new StashLoader();
	const league = ref<League>(ACTIVE_LEAGUE as League);
	const stashVisible = ref(false);
	const shouldShowImportActions = computed(() => !stashVisible.value || !authStore.loggedIn);
	const tabsWithItems: Ref<TabWithItems[]> = ref<TabWithItems[]>([]);
	const selectedIds = ref<string[]>([]);
	const aggregatedTab = computed<TabWithItems | null>(() => {
		const map = new Map<string, TabWithItems>();
		for (const t of tabsWithItems.value) map.set(t.id, t);
		const ids = selectedIds.value.length ? selectedIds.value : Array.from(map.keys());
		const items: TabWithItems['items'] = [];
		for (const id of ids) {
			const t = map.get(id);
			if (t) items.push(...t.items);
		}
		if (!items.length) return null;
		return { id: 'aggregate', name: 'Aggregate', type: 'NormalStash', index: 0, items } as TabWithItems;
	});
	const availableTabs = ref<{ id: string; name: string; type: string }[]>([]);
	const selectedTabId = ref<string | null>(null);
	const extractingSelected = ref(false);
	const stashesViewRef = shallowRef<HTMLElement | null>(null);
	const bulkMode = ref<boolean>(false);

	const resetStashState = (closeVisible: boolean = true) => {
		tabsWithItems.value = [];
		selectedIds.value = [];
		availableTabs.value = [];
		selectedTabId.value = null;
		bulkMode.value = false;
		if (closeVisible) stashVisible.value = false;
	};

	const bulkLoadStash = async () => {
		if (!authStore.loggedIn) {
			await authStore.login();
		}
		stashVisible.value = true;
		bulkMode.value = true;
		await nextTick();
		stashesViewRef.value?.dispatchEvent(new Event('stashes__bulk-load-all'));
	};

	const openStashWindow = async () => {
		try {
			if (!authStore.loggedIn) {
				await authStore.login();
			}
			stashVisible.value = true;
			bulkMode.value = false;
			const tabs = await stashLoader.tabs(league.value);
			availableTabs.value = tabs.filter(t => t.type === 'DivinationCardStash');
			if (availableTabs.value.length && !selectedTabId.value) {
				selectedTabId.value = availableTabs.value[0].id;
			}
		} catch (err) {
			handleError(err);
			stashVisible.value = false;
		}
	};

	const extractSelectedTab = async () => {
		if (extractingSelected.value) return;
		if (!authStore.loggedIn) {
			await authStore.login();
		}
		if (!selectedTabId.value) {
			toast('warning', 'Select a Divination Card tab');
			return;
		}
		try {
			extractingSelected.value = true;
			const tab = availableTabs.value.find(t => t.id === selectedTabId.value);
			if (!tab) {
				toast('warning', 'Selected tab not found');
				extractingSelected.value = false;
				return;
			}
			const sample = await stashLoader.sampleFromTab(tab.id, league.value);
			await sampleStore.addSample(tab.name, sample, league.value);
			toast('success', `Extracted cards from ${tab.name}`);
		} catch (err) {
			console.log('Failed to extract selected tab', selectedTabId.value, err);
			toast('danger', 'Failed to extract selected tab');
		}
		extractingSelected.value = false;
	};

	const changeLeague = (e: any) => {
		const l = e.$league as League;
		if (isTradeLeague(l)) {
			league.value = l;
			resetStashState();
		}
	};

	const handle_stashtab_fetched = (e: StashtabFetchedEvent) => {
		e.$stashtab.items.sort((a, b) => (b.stackSize ?? 0) - (a.stackSize ?? 0));
		tabsWithItems.value.push(e.$stashtab);
	};

	const handle_extract_cards = async (e: ExtractCardsEvent) => {
		const sample = await command('extract_cards', { tab: e.$tab, league: e.$league });
		sampleStore.addSample(e.$tab.name, sample, e.$league);
	};

	return {
		stashLoader,
		league,
		stashVisible,
		shouldShowImportActions,
		tabsWithItems,
		selectedIds,
		aggregatedTab,
		availableTabs,
		selectedTabId,
		extractingSelected,
		stashesViewRef,
		bulkMode,
		resetStashState,
		bulkLoadStash,
		openStashWindow,
		extractSelectedTab,
		changeLeague,
		handle_stashtab_fetched,
		handle_extract_cards,
	};
};
