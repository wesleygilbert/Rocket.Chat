import { useSession, useUserId, useSetting } from '@rocket.chat/ui-contexts';
import type { ReactElement, ReactNode } from 'react';
import React from 'react';

import LoginPage from './LoginPage';
import UsernameCheck from './UsernameCheck';

const AuthenticationCheck = ({ children }: { children: ReactNode }): ReactElement => {
	const uid = useUserId();
	const allowAnonymousRead = useSetting('Accounts_AllowAnonymousRead');
	const forceLogin = useSession('forceLogin');

	const showLogin = !uid && (allowAnonymousRead !== true || forceLogin === true);

	if (showLogin) {
		return <LoginPage />;
	}

	return <UsernameCheck>{children}</UsernameCheck>;
};

export default AuthenticationCheck;
