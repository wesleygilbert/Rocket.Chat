import { Settings } from '@rocket.chat/models';

import { addMigration } from '../../lib/migrations';
import { Users } from '../../../app/models/server';

addMigration({
	version: 259,
	up() {
		Users.update(
			{ 'settings.preferences.enableMessageParserEarlyAdoption': { $exists: 1 } },
			{
				$unset: { 'settings.preferences.enableMessageParserEarlyAdoption': 1 },
			},
			{ multi: true },
		);
		return Settings.removeById('Accounts_Default_User_Preferences_enableMessageParserEarlyAdoption');
	},
});
