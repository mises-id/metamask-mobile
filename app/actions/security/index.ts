/* eslint-disable import/prefer-default-export */
import type { Action } from 'redux';

export enum ActionType {
  SET_REMEMBER_ME_ENABLED = 'SET_REMEMBER_ME_ENABLED',
}

export interface RememberMeEnabledUpdated
  extends Action<ActionType.SET_REMEMBER_ME_ENABLED> {
  enabled: boolean;
}

export type Action = RememberMeEnabledUpdated;

export const setRememberMeEnabled = (
  enabled: boolean,
): RememberMeEnabledUpdated => ({
  type: ActionType.SET_REMEMBER_ME_ENABLED,
  enabled,
});
