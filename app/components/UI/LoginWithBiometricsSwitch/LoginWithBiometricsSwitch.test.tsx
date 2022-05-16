import React from 'react';
import { shallow } from 'enzyme';
import LoginWithBiometricsSwitch from './LoginWithBiometricsSwitch';
import { BIOMETRY_TYPE } from 'react-native-keychain';
describe('LoginWithBiometricsSwitch', () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleUpdate = (_biometricsEnabled: boolean) => {};
  it('should render correctly', () => {
    const wrapper = shallow(
      <LoginWithBiometricsSwitch
        biometryType={BIOMETRY_TYPE.FINGERPRINT}
        onUpdateBiometryChoice={handleUpdate}
      />,
    );
    expect(wrapper).toMatchSnapshot();
  });
});
