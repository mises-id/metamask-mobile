/* eslint-disable @typescript-eslint/default-param-last */
import { ActionType, Action } from '../../actions/security';
// import type { Action } from '../../actions/security';
import { SecuritySettingsState } from '../../actions/security/state';
const initialState: Readonly<SecuritySettingsState> = {
  rememberMeEnabled: false,
};

const securityReducer = (
  state: SecuritySettingsState = initialState,
  action: Action,
): SecuritySettingsState => {
  switch (action.type) {
    case ActionType.SET_REMEMBER_ME_ENABLED:
      return {
        rememberMeEnabled: action.enabled,
      };
    default:
      return state;
  }
};

export default securityReducer;
