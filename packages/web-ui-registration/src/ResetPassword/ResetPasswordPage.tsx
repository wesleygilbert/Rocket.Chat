import { Button, Field, Modal, PasswordInput } from '@rocket.chat/fuselage';
import { useUniqueId } from '@rocket.chat/fuselage-hooks';
import { Form } from '@rocket.chat/layout';
import { PasswordVerifier, useValidatePassword } from '@rocket.chat/ui-client';
import type { TranslationKey } from '@rocket.chat/ui-contexts';
import { useSetting, useRouter, useRouteParameter, useUser, useMethod, useTranslation, useLoginWithToken } from '@rocket.chat/ui-contexts';
import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';

import HorizontalTemplate from '../template/HorizontalTemplate';

const getChangePasswordReason = ({
	requirePasswordChange,
	requirePasswordChangeReason = requirePasswordChange ? 'You_need_to_change_your_password' : 'Please_enter_your_new_password_below',
}: { requirePasswordChange?: boolean; requirePasswordChangeReason?: TranslationKey } = {}): TranslationKey => requirePasswordChangeReason;

const ResetPasswordPage = (): ReactElement => {
	const user = useUser();
	const t = useTranslation();
	const setUserPassword = useMethod('setUserPassword');
	const resetPassword = useMethod('resetPassword');
	const token = useRouteParameter('token');

	const passwordId = useUniqueId();
	const passwordVerifierId = useUniqueId();

	const requiresPasswordConfirmation = useSetting('Accounts_RequirePasswordConfirmation');

	const router = useRouter();

	const changePasswordReason = getChangePasswordReason(user || {});

	const loginWithToken = useLoginWithToken();

	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isValid },
		watch,
	} = useForm<{
		password: string;
		passwordConfirmation: string;
	}>({
		mode: 'onBlur',
	});

	const password = watch('password');
	const passwordIsValid = useValidatePassword(password);

	const submit = handleSubmit(async (data) => {
		try {
			if (token) {
				const result = await resetPassword(token, data.password);
				await loginWithToken(result.token);
				router.navigate('/home');
			} else {
				await setUserPassword(data.password);
			}
		} catch ({ error, reason }: any) {
			const _error = reason ?? error;
			setError('password', { message: String(_error) });
		}
	});

	return (
		<HorizontalTemplate>
			<Form onSubmit={submit}>
				<Form.Header>
					<Modal.Title textAlign='start'>{t('Reset_password')}</Modal.Title>
				</Form.Header>
				<Form.Container>
					<Field>
						<Field.Label htmlFor='password'>{t(changePasswordReason)}</Field.Label>
						<Field.Row>
							<PasswordInput
								{...register('password', {
									required: true,
									validate: () => (!passwordIsValid ? t('Password_must_meet_the_complexity_requirements') : true),
								})}
								error={errors.password?.message}
								aria-invalid={errors.password ? 'true' : 'false'}
								id={passwordId}
								placeholder={t('Create_a_password')}
								name='password'
								autoComplete='off'
								aria-describedby={passwordVerifierId}
							/>
						</Field.Row>
						{errors?.password && (
							<Field.Error aria-live='assertive' id={`${passwordId}-error`}>
								{errors.password.message}
							</Field.Error>
						)}
						<PasswordVerifier password={password} id={passwordVerifierId} />
						{requiresPasswordConfirmation && (
							<Field.Row>
								<PasswordInput
									{...register('passwordConfirmation', {
										required: true,
										deps: ['password'],
										validate: (val: string) => password === val,
									})}
									error={errors.passwordConfirmation?.type === 'validate' ? t('registration.component.form.invalidConfirmPass') : undefined}
									aria-invalid={errors.passwordConfirmation ? 'true' : false}
									id='passwordConfirmation'
									placeholder={t('Confirm_password')}
									disabled={!passwordIsValid}
								/>
							</Field.Row>
						)}
						{errors && <Field.Error>{errors.password?.message}</Field.Error>}
					</Field>
				</Form.Container>
				<Form.Footer>
					<Modal.FooterControllers>
						<Button primary disabled={!isValid} type='submit'>
							{t('Reset')}
						</Button>
					</Modal.FooterControllers>
				</Form.Footer>
			</Form>
		</HorizontalTemplate>
	);
};

export default ResetPasswordPage;
