import type { ComponentChildren } from 'preact';
import type { CSSProperties } from 'preact/compat';
import type { JSXInternal } from 'preact/src/jsx';
import { useTranslation } from 'react-i18next';

import { createClassName } from '../helpers';
import styles from './styles.scss';

const handleMouseUp: JSXInternal.EventHandler<JSXInternal.TargetedMouseEvent<HTMLButtonElement>> = ({ target }) =>
	(target as HTMLButtonElement)?.blur();

type ButtonProps = {
	children?: ComponentChildren;
	submit?: boolean;
	disabled?: boolean;
	outline?: boolean;
	nude?: boolean;
	danger?: boolean;
	secondary?: boolean;
	stack?: boolean;
	small?: boolean;
	loading?: boolean;
	badge?: number;
	icon?: ComponentChildren;
	className?: string;
	style?: CSSProperties;
	img?: string;
	onClick?: JSXInternal.MouseEventHandler<HTMLButtonElement>;
};

export const Button = ({
	submit,
	disabled,
	outline,
	nude,
	danger,
	secondary,
	stack,
	small,
	loading,
	badge,
	icon,
	onClick,
	className,
	style = {},
	children,
	img,
}: ButtonProps) => {
	const { t } = useTranslation();
	return (
		<button
			type={submit ? 'submit' : 'button'}
			disabled={disabled}
			onClick={onClick}
			onMouseUp={handleMouseUp}
			aria-label={icon && Array.isArray(children) ? children[0] : children}
			className={createClassName(
				styles,
				'button',
				{
					disabled,
					outline,
					nude,
					danger,
					secondary,
					stack,
					small,
					loading,
					icon: !!icon,
					img,
				},
				[className],
			)}
			style={Object.assign(
				{},
				style,
				img && {
					backgroundImage: `url(${img})`,
				},
			)}
		>
			{badge ? (
				<span role='status' aria-label={t('unread_messages_count', { count: badge })} className={createClassName(styles, 'button__badge')}>
					{badge}
				</span>
			) : null}
			{!img && (icon || children)}
		</button>
	);
};
