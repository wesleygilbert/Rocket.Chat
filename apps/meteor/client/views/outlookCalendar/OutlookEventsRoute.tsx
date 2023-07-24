import React, { useState } from 'react';

import { useTabBarClose } from '../room/contexts/ToolboxContext';
import OutlookEventsList from './OutlookEventsList';
import OutlookSettingsList from './OutlookSettingsList';

type OutlookCalendarRoutes = 'list' | 'settings';

const CALENDAR_ROUTES: { [key: string]: OutlookCalendarRoutes } = {
	LIST: 'list',
	SETTINGS: 'settings',
};

const OutlookEventsRoute = () => {
	const closeTabBar = useTabBarClose();
	const [calendarRoute, setCalendarRoute] = useState<OutlookCalendarRoutes>('list');

	if (calendarRoute === CALENDAR_ROUTES.SETTINGS) {
		return <OutlookSettingsList onClose={closeTabBar} changeRoute={() => setCalendarRoute(CALENDAR_ROUTES.LIST)} />;
	}

	return <OutlookEventsList onClose={closeTabBar} changeRoute={() => setCalendarRoute(CALENDAR_ROUTES.SETTINGS)} />;
};

export default OutlookEventsRoute;
