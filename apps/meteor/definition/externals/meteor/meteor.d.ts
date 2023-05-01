import 'meteor/meteor';
import type { IStreamerConstructor, IStreamer } from 'meteor/rocketchat:streamer';

declare module 'meteor/meteor' {
	namespace Meteor {
		const Streamer: IStreamerConstructor & IStreamer;

		namespace StreamerCentral {
			const instances: {
				[name: string]: IStreamer;
			};
		}

		interface ErrorStatic {
			new (error: string | number, reason?: string, details?: any): Error;
		}

		interface Error extends globalThis.Error {
			error: string | number;
			reason?: string;
		}

		interface Device {
			isDesktop: () => boolean;
		}

		const server: any;

		const runAsUser: <T>(userId: string, scope: () => T) => T;

		interface MethodThisType {
			twoFactorChecked: boolean | undefined;
		}

		interface IDDPMessage {
			msg: 'method';
			method: string;
			params: EJSON[];
			id: string;
		}

		interface IDDPUpdatedMessage {
			msg: 'updated';
			methods: string[];
		}

		interface IMeteorConnection {
			_send(message: IDDPMessage): void;

			_methodInvokers: Record<string, any>;

			_livedata_data(message: IDDPUpdatedMessage): void;

			_stream: {
				eventCallbacks: {
					message: Array<(data: string) => void>;
				};
				socket: {
					onmessage: (data: { type: string; data: string }) => void;
					_didMessage: (data: string) => void;
					send: (data: string) => void;
				};
				_launchConnectionAsync: () => void;
				allowConnection: () => void;
			};

			onMessage(message: string): void;

			status(): {
				connected: boolean;
				retryCount?: number;
				retryTime?: number;
				status: 'connected' | 'connecting' | 'failed' | 'waiting' | 'offline';
				reconnect: () => void;
			};
		}

		const connection: IMeteorConnection;

		function _relativeToSiteRootUrl(path: string): string;
		const _localStorage: Window['localStorage'];

		function loginWithLDAP(
			username: string | object,
			password: string,
			cb: (error?: Error | Meteor.Error | Meteor.TypedError) => void,
		): void;

		function loginWithCrowd(
			username: string | object,
			password: string,
			cb: (error?: Error | Meteor.Error | Meteor.TypedError) => void,
		): void;
	}
}
