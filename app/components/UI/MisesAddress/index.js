import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Text } from 'react-native';
import { formatAddress } from '../../../util/address';

/**
 * View that renders an mises address
 * or its ENS name when supports reverse lookup
 */
class MisesAddress extends PureComponent {
  static propTypes = {
    /**
     * Styles to be applied to the text component
     */
    style: PropTypes.any,
    /**
     * Address to be rendered and resolved
     */
    address: PropTypes.string,
  };

  ens = null;
  constructor(props) {
    super(props);
    const { address } = props;

    this.state = {
      ensName: null,
      address: formatAddress(address, 'misesShort'),
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.address && prevProps.address !== this.props.address) {
      requestAnimationFrame(() => {
        this.formatAndResolveIfNeeded();
      });
    }
  }

  formatAndResolveIfNeeded() {
    const { address } = this.props;
    const formattedAddress = formatAddress(address, 'misesShort');
    this.setState({ address: formattedAddress, ensName: null });
  }

  render() {
    return (
      <Text style={this.props.style} numberOfLines={1}>
        {this.state.address}
      </Text>
    );
  }
}

MisesAddress.defaultProps = {
  style: null,
};

export default MisesAddress;
