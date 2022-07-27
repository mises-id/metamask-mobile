/**
 * @file  index
 * @date 2022-07-26
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppThemeFromContext, mockTheme } from '../../../../util/theme';
import { strings } from '../../../../../locales/i18n';
import Summary from '../../../../components/Base/Summary';
import PropTypes from 'prop-types';

const createStyles = (colors) =>
  StyleSheet.create({
    overview: (noMargin) => ({
      marginHorizontal: noMargin ? 0 : 24,
      paddingTop: 10,
      paddingBottom: 10,
    }),
    valuesContainer: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    gasInfoContainer: {
      paddingLeft: 2,
    },
    gasInfoIcon: (hasOrigin) => ({
      color: hasOrigin ? colors.secondary.default : colors.icon.muted,
    }),
    amountContainer: {
      flex: 1,
      paddingRight: 10,
    },
    gasRowContainer: {
      flexDirection: 'row',
      flex: 1,
      alignItems: 'center',
      marginBottom: 2,
    },
    gasBottomRowContainer: {
      marginTop: 4,
    },
    hitSlop: {
      top: 10,
      left: 10,
      bottom: 10,
      right: 10,
    },
    redInfo: {
      color: colors.error.default,
    },
    timeEstimateContainer: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    flex: {
      flex: 1,
    },

    textInput: {
      borderWidth: 1,
      borderRadius: 4,
      borderColor: colors.border.default,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      width: '80%',
      color: colors.text.default,
    },
  });
const TransactionReviewMises = ({
  noMargin,
  originWarning,
  origin,
  getMemo,
}) => {
  const { colors } = useAppThemeFromContext() || mockTheme;
  const styles = createStyles(colors);
  const themeAppearance = 'light';
  const [memo, setMemo] = React.useState('');
  const onChange = (value) => {
    setMemo(value);
    getMemo(value);
  };
  return (
    <Summary style={styles.overview(noMargin)}>
      {/* <Summary.Row>
        <View style={styles.gasRowContainer}>
          <View style={styles.gasRowContainer}>
            <Text
              primary={!originWarning}
              bold
              orange={Boolean(originWarning)}
              noMargin
            >
              {!origin
                ? strings('transaction_review_eip1559.estimated_gas_fee')
                : strings('transaction_review_eip1559.suggested_gas_fee', {
                    origin,
                  })}
            </Text>
          </View>
          <FadeAnimationView
            style={styles.valuesContainer}
            valueToWatch={valueToWatchAnimation}
            animateOnChange={animateOnChange}
            onAnimationStart={onUpdatingValuesStart}
            onAnimationEnd={onUpdatingValuesEnd}
          >
            <Text
              upper
              right
              grey={nativeCurrencySelected}
              style={styles.amountContainer}
              noMargin
              adjustsFontSizeToFit
              numberOfLines={2}
            >
              {gasFeeSecondary}
            </Text>
          </FadeAnimationView>
        </View>
      </Summary.Row>
      <Summary.Separator /> */}
      <Summary.Row>
        <View style={styles.gasRowContainer}>
          <View style={styles.gasRowContainer}>
            <Text
              primary={!originWarning}
              bold
              orange={Boolean(originWarning)}
              noMargin
            >
              Memo
            </Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder={'Add a memo'}
            placeholderTextColor={colors.text.muted}
            value={memo}
            onChangeText={onChange}
            testID={'input-memo'}
            keyboardAppearance={themeAppearance}
          />
        </View>
      </Summary.Row>
    </Summary>
  );
};
TransactionReviewMises.propTypes = {
  /**
   * Boolean to determine the container should have no margin
   */
  noMargin: PropTypes.bool,
  /**
   * If it's a eip1559 network and dapp suggest legact gas then it should show a warning
   */
  originWarning: PropTypes.bool,
  /**
   * Origin (hostname) of the dapp that suggested the gas fee
   */
  origin: PropTypes.string,
  /**
   * Origin (hostname) of the dapp that suggested the gas fee
   */
  getMemo: PropTypes.func,
};
export default TransactionReviewMises;
