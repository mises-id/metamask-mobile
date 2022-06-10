import React, { useCallback, useState } from 'react';
import { View, Switch, Text } from 'react-native';
import { mockTheme, useAppThemeFromContext } from '../../../util/theme';
import { strings } from '../../../../locales/i18n';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { createStyles } from './styles';
import { LOGIN_WITH_BIOMETRICS_SWITCH } from '../../../constants/test-ids';
import { useSelector } from 'react-redux';

interface Props {
  biometryType?: BIOMETRY_TYPE;
  onUpdateBiometryChoice: (biometryEnabled: boolean) => void;
  onUpdateRememberMe: (rememberMeEnabled: boolean) => void;
}

const LoginOptionsSwitch = ({
  biometryType,
  onUpdateBiometryChoice,
  onUpdateRememberMe,
}: Props) => {
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  const rememberOptionMeEnabled = useSelector(
    (state: any) => state.security.rememberMeEnabled,
  );
  const [biometryEnabled, setBiometryEnabled] = useState<boolean>(false);
  const [rememberMeEnabled, setRememberMeEnabled] = useState<boolean>(false);

  const onBiometryValueChanged = useCallback(async () => {
    onUpdateBiometryChoice(biometryEnabled);
    setBiometryEnabled(!biometryEnabled);
  }, [biometryEnabled, onUpdateBiometryChoice]);

  const onRememberMeValueChanged = useCallback(async () => {
    onUpdateRememberMe(rememberMeEnabled);
    setRememberMeEnabled(!rememberMeEnabled);
  }, [onUpdateRememberMe, rememberMeEnabled]);

  // should only render remember me if biometrics are disabled and rememberOptionMeEnabled is enabled in security settings
  // if both are disabled then this component returns null
  if (biometryType !== undefined) {
    return (
      <View style={styles.container} testID={LOGIN_WITH_BIOMETRICS_SWITCH}>
        <Text style={styles.label}>
          {strings(`biometrics.enable_${biometryType.toLowerCase()}`)}
        </Text>
        <Switch
          onValueChange={onBiometryValueChanged}
          value={biometryEnabled}
          style={styles.switch}
          trackColor={{
            true: colors.primary.default,
            false: colors.border.muted,
          }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.border.muted}
        />
      </View>
    );
  } else if (biometryType === undefined && rememberOptionMeEnabled === true) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {strings(`choose_password.remember_me`)}
        </Text>
        <Switch
          onValueChange={onRememberMeValueChanged}
          value={rememberMeEnabled}
          style={styles.switch}
          trackColor={{
            true: colors.primary.default,
            false: colors.border.muted,
          }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.border.muted}
          testID={'remember-me-toggle'}
        />
      </View>
    );
  }
  return null;
};

export default React.memo(LoginOptionsSwitch);
