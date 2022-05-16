import React, { useCallback, useState } from 'react';
import { View, Switch, Text } from 'react-native';
import { mockTheme, useAppThemeFromContext } from '../../../util/theme';
import { strings } from '../../../../locales/i18n';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { createStyles } from './styles';
import { LOGIN_WITH_BIOMETRICS_SWITCH } from '../../../constants/test-ids';

interface Props {
  biometryType: BIOMETRY_TYPE;
  onUpdateBiometryChoice: (biometryEnabled: boolean) => void;
}

const LoginWithBiometricsSwitch = ({
  biometryType,
  onUpdateBiometryChoice,
}: Props) => {
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  const [biometryEnabled, setBiometryEnabled] = useState<boolean>(false);

  const onValueChanged = useCallback(async () => {
    onUpdateBiometryChoice(biometryEnabled);
    setBiometryEnabled(!biometryEnabled);
  }, [biometryEnabled, onUpdateBiometryChoice]);

  return (
    <View style={styles.biometrics} testID={LOGIN_WITH_BIOMETRICS_SWITCH}>
      <Text style={styles.biometryLabel}>
        {strings(`biometrics.enable_${biometryType.toLowerCase()}`)}
      </Text>
      <Switch
        onValueChange={onValueChanged}
        value={biometryEnabled}
        style={styles.biometrySwitch}
        trackColor={{
          true: colors.primary.default,
          false: colors.border.muted,
        }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.border.muted}
      />
    </View>
  );
};

export default React.memo(LoginWithBiometricsSwitch);
