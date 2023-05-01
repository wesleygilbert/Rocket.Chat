import type { PaginatedResult } from '@rocket.chat/rest-typings';
import type { ContextType } from 'react';
import { useMemo } from 'react';

import type { AsyncState } from '../../../../lib/asyncState';
import { AsyncStatePhase } from '../../../../lib/asyncState';
import type { AppsContext } from '../AppsContext';
import { filterAppsByCategories } from '../helpers/filterAppsByCategories';
import { filterAppsByDisabled } from '../helpers/filterAppsByDisabled';
import { filterAppsByEnabled } from '../helpers/filterAppsByEnabled';
import { filterAppsByFree } from '../helpers/filterAppsByFree';
import { filterAppsByPaid } from '../helpers/filterAppsByPaid';
import { filterAppsByText } from '../helpers/filterAppsByText';
import { sortAppsByAlphabeticalOrInverseOrder } from '../helpers/sortAppsByAlphabeticalOrInverseOrder';
import { sortAppsByClosestOrFarthestModificationDate } from '../helpers/sortAppsByClosestOrFarthestModificationDate';
import type { App } from '../types';

type appsDataType = ContextType<typeof AppsContext>['installedApps'] | ContextType<typeof AppsContext>['marketplaceApps'];

export const useFilteredApps = ({
	appsData,
	text,
	current,
	itemsPerPage,
	categories = [],
	purchaseType,
	sortingMethod,
	status,
}: {
	appsData: appsDataType;
	text: string;
	current: number;
	itemsPerPage: number;
	categories?: string[];
	purchaseType?: string;
	sortingMethod?: string;
	status?: string;
}): AsyncState<{ items: App[] } & { shouldShowSearchText: boolean } & PaginatedResult & { allApps: App[] }> => {
	const value = useMemo(() => {
		if (appsData.value === undefined) {
			return undefined;
		}

		const { apps } = appsData.value;

		let filtered: App[] = apps;
		let shouldShowSearchText = true;

		const sortingMethods: Record<string, () => App[]> = {
			az: () => filtered.sort((firstApp, secondApp) => sortAppsByAlphabeticalOrInverseOrder(firstApp.name, secondApp.name)),
			za: () => filtered.sort((firstApp, secondApp) => sortAppsByAlphabeticalOrInverseOrder(secondApp.name, firstApp.name)),
			mru: () =>
				filtered.sort((firstApp, secondApp) => sortAppsByClosestOrFarthestModificationDate(firstApp.modifiedAt, secondApp.modifiedAt)),
			lru: () =>
				filtered.sort((firstApp, secondApp) => sortAppsByClosestOrFarthestModificationDate(secondApp.modifiedAt, firstApp.modifiedAt)),
		};

		if (sortingMethod) {
			filtered = sortingMethods[sortingMethod]();
		}

		if (purchaseType && purchaseType !== 'all') {
			filtered = purchaseType === 'paid' ? filtered.filter(filterAppsByPaid) : filtered.filter(filterAppsByFree);

			if (!filtered.length) shouldShowSearchText = false;
		}

		if (status && status !== 'all') {
			filtered = status === 'enabled' ? filtered.filter(filterAppsByEnabled) : filtered.filter(filterAppsByDisabled);

			if (!filtered.length) shouldShowSearchText = false;
		}

		if (Boolean(categories.length) && Boolean(text)) {
			filtered = apps.filter((app) => filterAppsByCategories(app, categories)).filter(({ name }) => filterAppsByText(name, text));
			shouldShowSearchText = true;
		}

		if (Boolean(categories.length) && !text) {
			filtered = apps.filter((app) => filterAppsByCategories(app, categories));
			shouldShowSearchText = false;
		}

		if (!categories.length && Boolean(text)) {
			filtered = apps.filter(({ name }) => filterAppsByText(name, text));
			shouldShowSearchText = true;
		}

		const total = filtered.length;
		const offset = current > total ? 0 : current;
		const end = current + itemsPerPage;
		const slice = filtered.slice(offset, end);

		return { items: slice, offset, total: apps.length, count: slice.length, shouldShowSearchText, allApps: filtered };
	}, [appsData.value, sortingMethod, purchaseType, status, categories, text, current, itemsPerPage]);

	if (appsData.phase === AsyncStatePhase.RESOLVED) {
		if (!value) {
			throw new Error('useFilteredApps - Unexpected state');
		}
		return {
			...appsData,
			value,
		};
	}

	if (appsData.phase === AsyncStatePhase.UPDATING) {
		throw new Error('useFilteredApps - Unexpected state');
	}

	return {
		...appsData,
		value: undefined,
	};
};
