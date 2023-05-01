import { Callout } from '@rocket.chat/fuselage';
import { useTranslation } from '@rocket.chat/ui-contexts';
import React from 'react';

import { FormSkeleton } from '../../../../client/components/Skeleton';
import { AsyncStatePhase } from '../../../../client/hooks/useAsyncState';
import { useEndpointData } from '../../../../client/hooks/useEndpointData';
import TagEdit from './TagEdit';
import TagEditWithDepartmentData from './TagEditWithDepartmentData';

function TagEditWithData({ tagId, reload, title }) {
	const { value: data, phase: state, error } = useEndpointData('/v1/livechat/tags/:tagId', { keys: { tagId } });

	const t = useTranslation();

	if ([state].includes(AsyncStatePhase.LOADING)) {
		return <FormSkeleton />;
	}

	if (error) {
		return (
			<Callout m='x16' type='danger'>
				{t('Not_Available')}
			</Callout>
		);
	}

	return (
		<>
			{data && data.departments && data.departments.length > 0 ? (
				<TagEditWithDepartmentData tagId={tagId} data={data} reload={reload} title={title} />
			) : (
				<TagEdit tagId={tagId} data={data} reload={reload} title={title} />
			)}
		</>
	);
}

export default TagEditWithData;
