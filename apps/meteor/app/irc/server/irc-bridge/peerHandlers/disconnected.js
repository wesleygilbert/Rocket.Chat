import { Meteor } from 'meteor/meteor';

import { Users } from '../../../../models/server';

export default function handleQUIT(args) {
	const user = Users.findOne({
		'profile.irc.nick': args.nick,
	});

	Meteor.users.update(
		{ _id: user._id },
		{
			$set: {
				status: 'offline',
			},
		},
	);
}
