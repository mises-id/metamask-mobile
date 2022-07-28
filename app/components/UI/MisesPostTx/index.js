import { fontStyles } from '../../../styles/common';
import { strings } from '../../../../locales/i18n';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Device from '../../../util/device';
import ActionView from '../ActionView';
import PropTypes from 'prop-types';
import { mockTheme, useAppThemeFromContext } from '../../../util/theme';
import Engine from '../../../core/Engine';
const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.background.default,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      paddingBottom: Device.isIphoneX() ? 20 : 0,
      minHeight: '50%',
    },
    title: {
      textAlign: 'center',
      fontSize: 18,
      marginVertical: 12,
      marginHorizontal: 20,
      color: colors.text.default,
      ...fontStyles.bold,
    },
    text: {
      ...fontStyles.normal,
      fontSize: 16,
      paddingTop: 25,
      paddingHorizontal: 10,
      color: colors.text.default,
    },
    children: {
      alignItems: 'center',
      borderTopColor: colors.border.muted,
      borderTopWidth: 1,
    },
    infoTitle: {
      ...fontStyles.bold,
      color: colors.text.default,
      paddingTop: 12,
      paddingBottom: 12,
      paddingHorizontal: 10,
      width: '90%',
    },
    information: {
      borderWidth: 1,
      borderColor: colors.border.muted,
      borderRadius: 5,
      marginTop: 5,
      marginHorizontal: 10,
    },
    informationWrapper: {
      width: '100%',
    },
    showValue: {
      borderTopWidth: 1,
      borderTopColor: colors.border.muted,
      padding: 10,
    },
  });
const MisesPostTx = (props) => {
  const { postTx, onCancel, onConfirm } = props;
  const { MisesController } = Engine.context;
  const [msg, setMsg] = useState([]);
  useEffect(() => {
    const msgs = postTx.tx.map((msg) => ({
      ...msg,
      typeUrl: MisesController.getReader(msg),
      show: false,
    }));
    setMsg(msgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  return (
    <View style={styles.root}>
      <View style={styles.titleWrapper}>
        <Text style={styles.title}>Post Tx</Text>
      </View>
      <ActionView onCancelPress={onCancel} onConfirmPress={onConfirm}>
        <View style={styles.children}>
          <View style={styles.informationWrapper}>
            {msg.map((item, index) => (
              <View key={index} style={styles.information}>
                <TouchableOpacity
                  onPress={() => {
                    const clickMsg = msg.map((val) => {
                      val.show = false;
                      return val;
                    });
                    clickMsg[index].show = true;
                    // item.show = !item.show;
                    setMsg([...clickMsg]);
                  }}
                >
                  <View style={styles.infoTitleWrapper}>
                    <Text style={styles.infoTitle} numberOfLines={1}>
                      {item.typeUrl}
                    </Text>
                  </View>
                </TouchableOpacity>
                {item.show && (
                  <Text style={styles.showValue}>
                    {JSON.stringify(item.value)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ActionView>
    </View>
  );
};
MisesPostTx.propTypes = {
  postTx: PropTypes.object,
  onCancel: PropTypes.func,
  onConfirm: PropTypes.func,
};
export default MisesPostTx;
