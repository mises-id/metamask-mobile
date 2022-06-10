import React from 'react';
import { shallow } from 'enzyme';
import LoginOptionsSwitch from './LoginOptionsSwitch';
import { BIOMETRY_TYPE } from 'react-native-keychain';
describe('LoginWithBiometricsSwitch', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleUpdate = (_biometricsEnabled: boolean) => {};
  it('should render correctly', () => {
    const wrapper = shallow(
      <LoginOptionsSwitch
        biometryType={BIOMETRY_TYPE.FACE}
        onUpdateBiometryChoice={handleUpdate}
        onUpdateRememberMe={handleUpdate}
      />,
    );
    expect(wrapper).toMatchSnapshot();
  });
});
