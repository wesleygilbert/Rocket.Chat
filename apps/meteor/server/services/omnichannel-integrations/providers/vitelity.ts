import { Base64 } from '@rocket.chat/base64';
import type { ISMSProvider, ServiceData, SMSProviderResult, SMSProviderResponse } from '@rocket.chat/core-typings';
import { serverFetch as fetch } from '@rocket.chat/server-fetch';

import { settings } from '../../../../app/settings/server';
import { SystemLogger } from '../../../lib/logger/system';

type VitelityData = {
	src: string;
	dst: string;
	msg: string;
	NumMedia?: string;
} & Record<`MediaUrl${number}`, string> &
	Record<`MediaContentType${number}`, string>;

const isVitelityData = (data: unknown): data is VitelityData => {
	if (typeof data !== 'object' || data === null) {
		return false;
	}

	const { src, dst, msg } = data as Record<string, unknown>;

	return typeof src === 'string' && typeof dst === 'string' && typeof msg === 'string';
};

export class Vitelity implements ISMSProvider {
	address: string;

	restAddress: string;

	username: string;

	password: string;

	from: string;

	constructor() {
		this.address = settings.get('SMS_Vitelity_gateway_address');
		this.restAddress = settings.get('SMS_Vitelity_restful_address');
		this.username = settings.get('SMS_Vitelity_username');
		this.password = settings.get('SMS_Vitelity_password');
		this.from = settings.get('SMS_Vitelity_from_number');
	}

	parse(data: unknown) {
		let numMedia = 0;

		if (!isVitelityData(data)) {
			throw new Error('Invalid data');
		}

		const returnData: ServiceData = {
			src: data.from,
			dst: data.to,
			msg: data.content,
		};

		if (data.NumMedia) {
			numMedia = parseInt(data.NumMedia, 10);
		}

		if (isNaN(numMedia)) {
			SystemLogger.error(`Error parsing NumMedia ${data.NumMedia}`);
			return returnData;
		}

		returnData.media = [];

		for (let mediaIndex = 0; mediaIndex < numMedia; mediaIndex++) {
			const media = {
				url: '',
				contentType: '',
			};

			const mediaUrl = data[`MediaUrl${mediaIndex}`];
			const contentType = data[`MediaContentType${mediaIndex}`];

			media.url = mediaUrl;
			media.contentType = contentType;

			returnData.media.push(media);
		}

		return returnData;
	}

	// @ts-expect-error -- typings :) for this method are wrong
	async send(
		fromNumber: string,
		toNumber: string,
		message: string,
		extraData: {
			username?: string;
			password?: string;
			address?: string;
		},
	): Promise<SMSProviderResult> {
		let currentFrom = this.from;
		let currentUsername = this.username;
		let currentAddress = this.address;
		let currentPassword = this.password;

		const { username, password, address } = extraData;
		if (fromNumber) {
			currentFrom = fromNumber;
		}
		if (username && password) {
			currentUsername = username;
			currentPassword = password;
		}
		if (address) {
			currentAddress = address;
		}

		const strippedTo = toNumber.replace(/\D/g, '');
		const result: SMSProviderResult = {
			isSuccess: false,
			resultMsg: 'An unknown error happened',
		};

		try {
			const response = await fetch(`${currentAddress}`, {
				params: {
					login: currentUsername,
					pass: currentPassword,
					cmd: 'sendsms'
					dst: strippedTo,
					src: currentFrom,
					msg: message,
				},
			});

			if (response.ok) {
				result.resultMsg = await response.text();
				result.isSuccess = true;
			} else {
				result.resultMsg = `Could not able to send SMS. Code:  ${response.status}`;
			}
		} catch (err) {
			result.resultMsg = `Error while sending SMS with Vitelity. Detail: ${err}`;
			SystemLogger.error({ msg: 'Error while sending SMS with Vitelity', err });
		}

		return result;
	}

	async sendBatch(fromNumber: string, toNumbersArr: string[], message: string): Promise<SMSProviderResult> {
		let currentFrom = this.from;
		if (fromNumber) {
			currentFrom = fromNumber;
		}

		const result: SMSProviderResult = {
			isSuccess: false,
			resultMsg: 'An unknown error happened',
			response: null,
		};

		try {
			const response = await fetch(`${this.restAddress}/secure/sendbatch`, {
				method: 'POST',
				headers: {
				},
				body: {
					messages: [
						{
							login: ${this.username},
							pass: ${this.password},
							dest: toNumbersArr,
							cmd: 'sendsms'
							src: currentFrom,
							msg: message,
						},
					],
				},
			});

			result.isSuccess = response.ok;
			result.resultMsg = 'Success';
			result.response = await response.text();
		} catch (err) {
			result.resultMsg = `Error while sending SMS with Vitelity. Detail: ${err}`;
			SystemLogger.error({ msg: 'Error while sending SMS with Vitelity', err });
		}

		return result;
	}

	response(): SMSProviderResponse {
		return {
			headers: {
				'Content-Type': 'text/xml',
			},
			body: 'ACK/Jasmin',
		};
	}

	error(error: Error & { reason?: string }): SMSProviderResponse {
		let message = '';
		if (error.reason) {
			message = `<Message>${error.reason}</Message>`;
		}
		return {
			headers: {
				'Content-Type': 'text/xml',
			},
			body: `<Response>${message}</Response>`,
		};
	}
}
