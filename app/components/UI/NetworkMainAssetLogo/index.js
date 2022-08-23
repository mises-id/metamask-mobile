import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import TokenIcon from '../Swaps/components/TokenIcon';
import { NetworksChainId } from '../../../core/misesNetworkController';

function NetworkMainAssetLogo({ chainId, ticker, style, big, biggest }) {
  if (chainId === NetworksChainId.mainnet) {
    return (
      <TokenIcon big={big} biggest={biggest} symbol={'ETH'} style={style} />
    );
  }
  if (chainId === NetworksChainId.mises) {
    return (
      <TokenIcon big={big} biggest={biggest} symbol={'MIS'} style={style} />
    );
  }
  return (
    <TokenIcon big={big} biggest={biggest} symbol={ticker} style={style} />
  );
}

const mapStateToProps = (state) => ({
  chainId: state.engine.backgroundState.NetworkController.provider.chainId,
  ticker: state.engine.backgroundState.NetworkController.provider.ticker,
});

NetworkMainAssetLogo.propTypes = {
  chainId: PropTypes.string,
  ticker: PropTypes.string,
  style: PropTypes.object,
  big: PropTypes.bool,
  biggest: PropTypes.bool,
};

export default connect(mapStateToProps)(NetworkMainAssetLogo);
