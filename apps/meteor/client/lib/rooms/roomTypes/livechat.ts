import type { AtLeast, ValueOf } from '@rocket.chat/core-typings';
import { Session } from 'meteor/session';

import { hasPermission } from '../../../../app/authorization/client';
import { LivechatInquiry } from '../../../../app/livechat/client/collections/LivechatInquiry';
import { ChatRoom, ChatSubscription } from '../../../../app/models/client';
import { settings } from '../../../../app/settings/client';
import { getAvatarURL } from '../../../../app/utils/lib/getAvatarURL';
import type { IRoomTypeClientDirectives } from '../../../../definition/IRoomTypeConfig';
import { RoomSettingsEnum, RoomMemberActions, UiTextContext } from '../../../../definition/IRoomTypeConfig';
import { getLivechatRoomType } from '../../../../lib/rooms/roomTypes/livechat';
import { roomCoordinator } from '../roomCoordinator';

export const LivechatRoomType = getLivechatRoomType(roomCoordinator);

roomCoordinator.add(LivechatRoomType, {
	allowRoomSettingChange(_room, setting) {
		switch (setting) {
			case RoomSettingsEnum.JOIN_CODE:
				return false;
			default:
				return true;
		}
	},

	allowMemberAction(_room, action) {
		return ([RoomMemberActions.INVITE, RoomMemberActions.JOIN] as Array<ValueOf<typeof RoomMemberActions>>).includes(action);
	},

	roomName(room) {
		return room.name || room.fname || (room as any).label;
	},

	getUiText(context) {
		switch (context) {
			case UiTextContext.HIDE_WARNING:
				return 'Hide_Livechat_Warning';
			case UiTextContext.LEAVE_WARNING:
				return 'Hide_Livechat_Warning';
			default:
				return '';
		}
	},

	condition() {
		return settings.get('Livechat_enabled') && hasPermission('view-l-room');
	},

	getAvatarPath(room) {
		return getAvatarURL({ username: `@${this.roomName(room)}` }) || '';
	},

	getUserStatus(rid) {
		const room = Session.get(`roomData${rid}`);
		if (room) {
			return room.v?.status;
		}
		const inquiry = LivechatInquiry.findOne({ rid });
		return inquiry?.v?.status;
	},

	findRoom(identifier) {
		return ChatRoom.findOne({ _id: identifier });
	},

	isLivechatRoom() {
		return true;
	},

	canSendMessage(rid) {
		const room = ChatRoom.findOne({ _id: rid }, { fields: { open: 1 } });
		return Boolean(room?.open);
	},

	readOnly(rid, _user) {
		const room = ChatRoom.findOne({ _id: rid }, { fields: { open: 1, servedBy: 1 } });
		if (!room || !room.open) {
			return true;
		}

		const subscription = ChatSubscription.findOne({ rid });
		return !subscription;
	},
} as AtLeast<IRoomTypeClientDirectives, 'roomName'>);
