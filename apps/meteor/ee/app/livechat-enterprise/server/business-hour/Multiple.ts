import moment from 'moment';
import type { ILivechatDepartment, ILivechatBusinessHour } from '@rocket.chat/core-typings';
import { LivechatDepartment, LivechatDepartmentAgents, Users } from '@rocket.chat/models';

import type { IBusinessHourBehavior } from '../../../../../app/livechat/server/business-hour/AbstractBusinessHour';
import { AbstractBusinessHourBehavior } from '../../../../../app/livechat/server/business-hour/AbstractBusinessHour';
import { filterBusinessHoursThatMustBeOpened } from '../../../../../app/livechat/server/business-hour/Helper';
import { closeBusinessHour, openBusinessHour, removeBusinessHourByAgentIds } from './Helper';
import { bhLogger } from '../lib/logger';
import { settings } from '../../../../../app/settings/server';
import { businessHourManager } from '../../../../../app/livechat/server/business-hour';

interface IBusinessHoursExtraProperties extends ILivechatBusinessHour {
	timezoneName: string;
	departmentsToApplyBusinessHour: string;
}

export class MultipleBusinessHoursBehavior extends AbstractBusinessHourBehavior implements IBusinessHourBehavior {
	constructor() {
		super();
		this.onAddAgentToDepartment = this.onAddAgentToDepartment.bind(this);
		this.onRemoveAgentFromDepartment = this.onRemoveAgentFromDepartment.bind(this);
		this.onRemoveDepartment = this.onRemoveDepartment.bind(this);
		this.onDepartmentArchived = this.onDepartmentArchived.bind(this);
		this.onDepartmentDisabled = this.onDepartmentDisabled.bind(this);
		this.onNewAgentCreated = this.onNewAgentCreated.bind(this);
	}

	async onStartBusinessHours(): Promise<void> {
		await this.UsersRepository.removeBusinessHoursFromAllUsers();
		await this.UsersRepository.updateLivechatStatusBasedOnBusinessHours();
		const currentTime = moment.utc(moment().utc().format('dddd:HH:mm'), 'dddd:HH:mm');
		const day = currentTime.format('dddd');
		const activeBusinessHours = await this.BusinessHourRepository.findActiveAndOpenBusinessHoursByDay(day, {
			projection: {
				workHours: 1,
				timezone: 1,
				type: 1,
				active: 1,
			},
		});
		const businessHoursToOpen = await filterBusinessHoursThatMustBeOpened(activeBusinessHours);
		bhLogger.debug({
			msg: 'Starting Multiple Business Hours',
			totalBusinessHoursToOpen: businessHoursToOpen.length,
			top10BusinessHoursToOpen: businessHoursToOpen.slice(0, 10),
		});
		for (const businessHour of businessHoursToOpen) {
			void this.openBusinessHour(businessHour);
		}
	}

	async openBusinessHoursByDayAndHour(day: string, hour: string): Promise<void> {
		const businessHours = await this.BusinessHourRepository.findActiveBusinessHoursToOpen(day, hour, undefined, {
			projection: {
				_id: 1,
				type: 1,
			},
		});
		for (const businessHour of businessHours) {
			void this.openBusinessHour(businessHour);
		}
	}

	async closeBusinessHoursByDayAndHour(day: string, hour: string): Promise<void> {
		const businessHours = await this.BusinessHourRepository.findActiveBusinessHoursToClose(day, hour, undefined, {
			projection: {
				_id: 1,
				type: 1,
			},
		});
		for (const businessHour of businessHours) {
			void this.closeBusinessHour(businessHour);
		}
	}

	async afterSaveBusinessHours(businessHourData: IBusinessHoursExtraProperties): Promise<void> {
		const departments = businessHourData.departmentsToApplyBusinessHour?.split(',').filter(Boolean);
		const currentDepartments = businessHourData.departments?.map((dept: any) => dept._id);
		const toRemove = [...(currentDepartments || []).filter((dept: Record<string, any>) => !departments.includes(dept._id))];
		await this.removeBusinessHourFromRemovedDepartmentsUsersIfNeeded(businessHourData._id, toRemove);
		const businessHour = await this.BusinessHourRepository.findOneById(businessHourData._id);
		if (!businessHour) {
			return;
		}
		const businessHourIdToOpen = (await filterBusinessHoursThatMustBeOpened([businessHour])).map((businessHour) => businessHour._id);
		if (!businessHourIdToOpen.length) {
			return closeBusinessHour(businessHour);
		}
		return openBusinessHour(businessHour);
	}

	async onAddAgentToDepartment(options: { departmentId: string; agentsId: string[] }): Promise<any> {
		const { departmentId, agentsId } = options;
		const department = await LivechatDepartment.findOneById<Pick<ILivechatDepartment, 'businessHourId'>>(departmentId, {
			projection: { businessHourId: 1 },
		});
		if (!department || !agentsId.length) {
			return options;
		}
		const defaultBusinessHour = await this.BusinessHourRepository.findOneDefaultBusinessHour();
		if (!defaultBusinessHour) {
			return options;
		}
		await removeBusinessHourByAgentIds(agentsId, defaultBusinessHour._id);
		if (!department.businessHourId) {
			return options;
		}
		const businessHour = await this.BusinessHourRepository.findOneById(department.businessHourId);
		if (!businessHour) {
			return options;
		}
		const businessHourToOpen = await filterBusinessHoursThatMustBeOpened([businessHour]);
		if (!businessHourToOpen.length) {
			return options;
		}
		await this.UsersRepository.addBusinessHourByAgentIds(agentsId, businessHour._id);
		return options;
	}

	async onRemoveAgentFromDepartment(options: Record<string, any> = {}): Promise<any> {
		const { departmentId, agentsId } = options;
		const department = await LivechatDepartment.findOneById<Pick<ILivechatDepartment, 'businessHourId'>>(departmentId, {
			projection: { businessHourId: 1 },
		});
		if (!department || !agentsId.length) {
			return options;
		}
		return this.handleRemoveAgentsFromDepartments(department, agentsId, options);
	}

	async onRemoveDepartment(options: { department: ILivechatDepartment; agentsIds: string[] }): Promise<any> {
		bhLogger.debug(`onRemoveDepartment: department ${options.department._id} removed`);
		const { department, agentsIds } = options;
		if (!department || !agentsIds?.length) {
			return options;
		}
		return this.onDepartmentDisabled(department);
	}

	async onDepartmentDisabled(department: ILivechatDepartment): Promise<void> {
		if (!department.businessHourId) {
			bhLogger.debug({
				msg: 'onDepartmentDisabled: department has no business hour',
				departmentId: department._id,
			});
			return;
		}

		// Get business hour
		let businessHour = await this.BusinessHourRepository.findOneById(department.businessHourId);
		if (!businessHour) {
			bhLogger.error({
				msg: 'onDepartmentDisabled: business hour not found',
				businessHourId: department.businessHourId,
			});
			return;
		}

		// Unlink business hour from department
		await LivechatDepartment.removeBusinessHourFromDepartmentsByIdsAndBusinessHourId([department._id], businessHour._id);

		// cleanup user's cache for default business hour and this business hour
		const defaultBH = await this.BusinessHourRepository.findOneDefaultBusinessHour();
		if (!defaultBH) {
			bhLogger.error('onDepartmentDisabled: default business hour not found');
			throw new Error('Default business hour not found');
		}
		await this.UsersRepository.closeAgentsBusinessHoursByBusinessHourIds([businessHour._id, defaultBH._id]);

		// If i'm the only one, disable the business hour
		const imTheOnlyOne = !(await LivechatDepartment.countByBusinessHourIdExcludingDepartmentId(businessHour._id, department._id));
		if (imTheOnlyOne) {
			bhLogger.warn({
				msg: 'onDepartmentDisabled: department is the only one on business hour, disabling it',
				departmentId: department._id,
				businessHourId: businessHour._id,
			});
			await this.BusinessHourRepository.disableBusinessHour(businessHour._id);

			businessHour = await this.BusinessHourRepository.findOneById(department.businessHourId);
			if (!businessHour) {
				bhLogger.error({
					msg: 'onDepartmentDisabled: business hour not found',
					businessHourId: department.businessHourId,
				});

				throw new Error(`Business hour ${department.businessHourId} not found`);
			}
		}

		// start default business hour and this BH if needed
		if (!settings.get('Livechat_enable_business_hours')) {
			bhLogger.debug(`onDepartmentDisabled: business hours are disabled. skipping`);
			return;
		}
		const businessHourToOpen = await filterBusinessHoursThatMustBeOpened([businessHour, defaultBH]);
		for await (const bh of businessHourToOpen) {
			bhLogger.debug({
				msg: 'onDepartmentDisabled: opening business hour',
				businessHourId: bh._id,
			});
			await openBusinessHour(bh, false);
		}

		await Users.updateLivechatStatusBasedOnBusinessHours();

		await businessHourManager.restartCronJobsIfNecessary();

		bhLogger.debug({
			msg: 'onDepartmentDisabled: successfully processed department disabled event',
			departmentId: department._id,
		});
	}

	async onDepartmentArchived(department: Pick<ILivechatDepartment, '_id'>): Promise<void> {
		bhLogger.debug('Processing department archived event on multiple business hours', department);
		const dbDepartment = await LivechatDepartment.findOneById(department._id, { projection: { businessHourId: 1, _id: 1 } });

		if (!dbDepartment) {
			bhLogger.error(`No department found with id: ${department._id} when archiving it`);
			return;
		}

		return this.onDepartmentDisabled(dbDepartment);
	}

	allowAgentChangeServiceStatus(agentId: string): Promise<boolean> {
		return this.UsersRepository.isAgentWithinBusinessHours(agentId);
	}

	private async handleRemoveAgentsFromDepartments(department: Record<string, any>, agentsIds: string[], options: any): Promise<any> {
		const agentIdsWithoutDepartment: string[] = [];
		const agentIdsToRemoveCurrentBusinessHour: string[] = [];
		for await (const agentId of agentsIds) {
			if ((await LivechatDepartmentAgents.findByAgentId(agentId).count()) === 0) {
				agentIdsWithoutDepartment.push(agentId);
			}
			// TODO: We're doing a full fledged aggregation with lookups and getting the whole array just for getting the length? :(
			if (!(await LivechatDepartmentAgents.findAgentsByAgentIdAndBusinessHourId(agentId, department.businessHourId)).length) {
				agentIdsToRemoveCurrentBusinessHour.push(agentId);
			}
		}
		if (department.businessHourId) {
			await removeBusinessHourByAgentIds(agentIdsToRemoveCurrentBusinessHour, department.businessHourId);
		}
		if (!agentIdsWithoutDepartment.length) {
			return options;
		}
		const defaultBusinessHour = await this.BusinessHourRepository.findOneDefaultBusinessHour();
		if (!defaultBusinessHour) {
			return options;
		}
		const businessHourToOpen = await filterBusinessHoursThatMustBeOpened([defaultBusinessHour]);
		if (!businessHourToOpen.length) {
			return options;
		}
		await this.UsersRepository.addBusinessHourByAgentIds(agentIdsWithoutDepartment, defaultBusinessHour._id);
		return options;
	}

	private async openBusinessHour(businessHour: Pick<ILivechatBusinessHour, '_id' | 'type'>): Promise<void> {
		return openBusinessHour(businessHour);
	}

	private async removeBusinessHourFromRemovedDepartmentsUsersIfNeeded(
		businessHourId: string,
		departmentsToRemove: string[],
	): Promise<void> {
		if (!departmentsToRemove.length) {
			return;
		}
		const agentIds = (await LivechatDepartmentAgents.findByDepartmentIds(departmentsToRemove).toArray()).map((dept: any) => dept.agentId);
		await removeBusinessHourByAgentIds(agentIds, businessHourId);
	}

	private async closeBusinessHour(businessHour: Pick<ILivechatBusinessHour, '_id' | 'type'>): Promise<void> {
		await closeBusinessHour(businessHour);
	}
}
