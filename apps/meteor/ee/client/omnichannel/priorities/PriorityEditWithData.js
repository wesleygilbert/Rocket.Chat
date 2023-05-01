import { Callout } from '@rocket.chat/fuselage';
import { useTranslation } from '@rocket.chat/ui-contexts';
import React from 'react';

import { FormSkeleton } from '../../../../client/components/Skeleton';
import { AsyncStatePhase } from '../../../../client/hooks/useAsyncState';
import { useEndpointData } from '../../../../client/hooks/useEndpointData';
import PriorityEdit from './PriorityEdit';

function PriorityEditWithData({ priorityId, reload }) {
	const { value: data, phase: state, error } = useEndpointData('/v1/livechat/priorities/:priorityId', { keys: { priorityId } });

	const t = useTranslation();

	if (state === AsyncStatePhase.LOADING) {
		return <FormSkeleton />;
	}

	if (error || !data) {
		return (
			<Callout m='x16' type='danger'>
				{t('Not_Available')}
			</Callout>
		);
	}

	return <PriorityEdit priorityId={priorityId} data={data} reload={reload} />;
}

export default PriorityEditWithData;
