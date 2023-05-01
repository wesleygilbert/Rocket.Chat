import type { IMessage, IRoom } from '@rocket.chat/core-typings';
import { Box, Throbber } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';
import { MessageComposerAction } from '@rocket.chat/ui-composer';
import { useSetting, useTranslation } from '@rocket.chat/ui-contexts';
import type { ReactElement, AllHTMLAttributes } from 'react';
import React, { useEffect, useMemo, useState } from 'react';

import { AudioRecorder } from '../../../../app/ui/client';
import type { ChatAPI } from '../../../lib/chats/ChatAPI';
import { useChat } from '../../room/contexts/ChatContext';

const audioRecorder = new AudioRecorder();

type AudioMessageRecorderProps = {
	rid: IRoom['_id'];
	tmid?: IMessage['_id'];
	chatContext?: ChatAPI; // TODO: remove this when the composer is migrated to React
} & Omit<AllHTMLAttributes<HTMLDivElement>, 'is'>;

const AudioMessageRecorder = ({ rid, chatContext, ...props }: AudioMessageRecorderProps): ReactElement | null => {
	const t = useTranslation();

	const [state, setState] = useState<'idle' | 'loading' | 'recording'>('idle');
	const [time, setTime] = useState('00:00');
	const [isMicrophoneDenied, setIsMicrophoneDenied] = useState(false);
	const [recordingInterval, setRecordingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
	const [recordingRoomId, setRecordingRoomId] = useState<IRoom['_id'] | null>(null);

	const stopRecording = useMutableCallback(async () => {
		if (recordingInterval) {
			clearInterval(recordingInterval);
		}
		setRecordingInterval(null);
		setRecordingRoomId(null);

		setTime('00:00');

		const blob = await new Promise<Blob>((resolve) => audioRecorder.stop(resolve));

		chat?.flows.action.stop('recording');

		chat?.composer?.setRecordingMode(false);

		setState('idle');

		return blob;
	});

	const handleMount = useMutableCallback(async (): Promise<void> => {
		if (navigator.permissions) {
			try {
				const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
				setIsMicrophoneDenied(permissionStatus.state === 'denied');
				permissionStatus.onchange = (): void => {
					setIsMicrophoneDenied(permissionStatus.state === 'denied');
				};
				return;
			} catch (error) {
				console.warn(error);
			}
		}

		if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
			setIsMicrophoneDenied(true);
			return;
		}

		try {
			if (!(await navigator.mediaDevices.enumerateDevices()).some(({ kind }) => kind === 'audioinput')) {
				setIsMicrophoneDenied(true);
				return;
			}
		} catch (error) {
			console.warn(error);
		}
	});

	const handleUnmount = useMutableCallback(async () => {
		if (state === 'recording') {
			await stopRecording();
		}
	});

	useEffect(() => {
		handleMount();

		return () => {
			handleUnmount();
		};
	}, [handleMount, handleUnmount]);

	const isFileUploadEnabled = useSetting('FileUpload_Enabled') as boolean;
	const isAudioRecorderEnabled = useSetting('Message_AudioRecorderEnabled') as boolean;
	const fileUploadMediaTypeBlackList = useSetting('FileUpload_MediaTypeBlackList') as string;
	const fileUploadMediaTypeWhiteList = useSetting('FileUpload_MediaTypeWhiteList') as string;

	const isAllowed = useMemo(
		() =>
			audioRecorder.isSupported() &&
			!isMicrophoneDenied &&
			isFileUploadEnabled &&
			isAudioRecorderEnabled &&
			(!fileUploadMediaTypeBlackList || !fileUploadMediaTypeBlackList.match(/audio\/mp3|audio\/\*/i)) &&
			(!fileUploadMediaTypeWhiteList || fileUploadMediaTypeWhiteList.match(/audio\/mp3|audio\/\*/i)),
		[fileUploadMediaTypeBlackList, fileUploadMediaTypeWhiteList, isAudioRecorderEnabled, isFileUploadEnabled, isMicrophoneDenied],
	);

	const stateClass = useMemo(() => {
		if (recordingRoomId && recordingRoomId !== rid) {
			return 'rc-message-box__audio-message--busy';
		}

		return state && `rc-message-box__audio-message--${state}`;
	}, [recordingRoomId, rid, state]);

	const handleRecordButtonClick = useMutableCallback(async () => {
		if (recordingRoomId && recordingRoomId !== rid) {
			return;
		}
		chat?.composer?.setRecordingMode(true);
		setState('recording');

		try {
			await audioRecorder.start();
			chat?.flows.action.performContinuously('recording');
			const startTime = new Date();
			setRecordingInterval(
				setInterval(() => {
					const now = new Date();
					const distance = (now.getTime() - startTime.getTime()) / 1000;
					const minutes = Math.floor(distance / 60);
					const seconds = Math.floor(distance % 60);
					setTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
				}, 1000),
			);
			setRecordingRoomId(rid);
		} catch (error) {
			console.log(error);
			setIsMicrophoneDenied(true);
			chat?.composer?.setRecordingMode(false);
			setState('idle');
		}
	});

	const handleCancelButtonClick = useMutableCallback(async () => {
		await stopRecording();
	});

	const chat = useChat() ?? chatContext;

	const handleDoneButtonClick = useMutableCallback(async () => {
		setState('loading');

		const blob = await stopRecording();

		const fileName = `${t('Audio_record')}.mp3`;
		const file = new File([blob], fileName, { type: 'audio/mpeg' });

		await chat?.flows.uploadFiles([file]);
	});

	if (!isAllowed) {
		return null;
	}

	if (state === 'idle') {
		return (
			<MessageComposerAction
				title={t('Audio_message')}
				icon='mic'
				className='rc-message-box__icon rc-message-box__audio-message-mic'
				data-qa-id='audio-record'
				onClick={handleRecordButtonClick}
				{...props}
			/>
		);
	}

	return (
		<div className={`rc-message-box__audio-message ${stateClass}`}>
			{state === 'recording' && (
				<>
					<MessageComposerAction
						icon='circle-cross'
						className='rc-message-box__icon rc-message-box__audio-message-cancel'
						onClick={handleCancelButtonClick}
					/>
					<Box className='rc-message-box__audio-message-timer' color='default'>
						<span className='rc-message-box__audio-message-timer-dot'></span>
						<span className='rc-message-box__audio-message-timer-text'>{time}</span>
					</Box>
					<MessageComposerAction
						icon='circle-check'
						className='rc-message-box__icon rc-message-box__audio-message-done'
						onClick={handleDoneButtonClick}
					/>
				</>
			)}
			{state === 'loading' && (
				<div className='rc-message-box__icon'>
					<Throbber inheritColor size='x12' />
				</div>
			)}
		</div>
	);
};

export default AudioMessageRecorder;
