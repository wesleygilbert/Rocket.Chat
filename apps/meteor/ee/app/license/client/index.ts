import { queryClient } from '../../../../client/lib/queryClient';
import { fetchFeatures } from '../../../client/lib/fetchFeatures';

export async function hasLicense(feature: string): Promise<boolean> {
	try {
		const features = await queryClient.fetchQuery({
			queryKey: ['ee.features'],
			queryFn: fetchFeatures,
		});
		return features.includes(feature);
	} catch (e) {
		console.error('Error getting modules', e);
		return false;
	}
}
