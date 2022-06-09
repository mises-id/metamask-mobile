import React, { useState, useCallback } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  mockTheme,
  useAppThemeFromContext,
} from '../../../../../../util/theme';
import { createStyles } from './styles';
import { colors as importedColors } from '../../../../../../styles/common';

interface SecurityOptionsToggleProps {
  title: string;
  description?: string;
  initialToggleState: boolean;
  onOptionUpdated: () => void;
  testId: string;
}

const SecurityOptionToggle = ({
  title,
  description,
  initialToggleState,
  testId,
}: SecurityOptionsToggleProps) => {
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  const [toggleState, setToggleState] = useState<boolean>(initialToggleState);

  const handleOnValueChange = useCallback(() => {
    setToggleState(!toggleState);
  }, [toggleState]);
  return (
    <View style={styles.setting} testID={testId}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      <View style={styles.switchElement}>
        <Switch
          value={toggleState}
          onValueChange={handleOnValueChange}
          trackColor={{
            true: colors.primary.default,
            false: colors.border.muted,
          }}
          thumbColor={importedColors.white}
          style={styles.switch}
          ios_backgroundColor={colors.border.muted}
        />
      </View>
    </View>
  );
};

export default React.memo(SecurityOptionToggle);
