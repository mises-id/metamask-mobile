import wallet_addEthereumChain from './wallet_addEthereumChain.js';
import wallet_switchEthereumChain from './wallet_switchEthereumChain.js';
import postTX from './mises/postTX';

const RPCMethods = {
  wallet_addEthereumChain,
  wallet_switchEthereumChain,
  postTX,
};

export default RPCMethods;
