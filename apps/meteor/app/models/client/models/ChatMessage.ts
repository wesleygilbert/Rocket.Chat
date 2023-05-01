import type { IMessage, IRoom } from '@rocket.chat/core-typings';
import { Mongo } from 'meteor/mongo';

class ChatMessageCollection extends Mongo.Collection<IMessage & { ignored?: boolean }> {
	constructor() {
		super(null);
	}

	findOneByRoomIdAndMessageId(rid: IRoom['_id'], messageId: IMessage['_id'], options?: Mongo.Options<IMessage>) {
		const query = {
			rid,
			_id: messageId,
		};

		return this.findOne(query, options);
	}
}

// TODO: check if we can dodge these missing typings from Meteor Collection Hooks
export const ChatMessage = new ChatMessageCollection() as unknown as Mongo.Collection<
	Omit<IMessage, '_id'> & { ignored?: boolean },
	IMessage & { ignored?: boolean }
> & {
	direct: Mongo.Collection<Omit<IMessage, '_id'>, IMessage>;

	queries: unknown[];
};
