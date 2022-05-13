import React, { useCallback } from 'react';
import { View, Switch, Text } from 'react-native';
import { mockTheme, useAppThemeFromContext } from '../../../util/theme';
import { strings } from '../../../../locales/i18n';
import AsyncStorage from '@react-native-community/async-storage';
import { TRUE, BIOMETRY_CHOICE_DISABLED } from '../../../constants/storage';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { createStyles } from './styles';
import { LOGIN_WITH_BIOMETRICS_SWITCH } from '../../../constants/test-ids';

interface Props {
  biometryType: BIOMETRY_TYPE;
  biometryEnabled: boolean;
}

const LoginWithBiometricsSwitch = ({
  biometryType,
  biometryEnabled,
}: Props) => {
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);

  const updateBiometryChoice = useCallback(async () => {
    if (!biometryEnabled) {
      await AsyncStorage.setItem(BIOMETRY_CHOICE_DISABLED, TRUE);
    } else {
      await AsyncStorage.removeItem(BIOMETRY_CHOICE_DISABLED);
    }
  }, [biometryEnabled]);

  return (
    <View style={styles.biometrics} testID={LOGIN_WITH_BIOMETRICS_SWITCH}>
      <Text style={styles.biometryLabel}>
        {strings(`biometrics.enable_${biometryType.toLowerCase()}`)}
      </Text>
      <Switch
        onValueChange={updateBiometryChoice}
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
