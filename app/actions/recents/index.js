import { safeToChecksumAddress } from '../../util/address';

/**
 * Action creator for adding account addresses to recents list.
 *
 * @param {string} recent Account address in any case format. Will be converted to checksum before being applied to the reducer.
 * @returns Action object that is recognized and handled by recents reducer.
 */
export default function addRecent(recent) {
  const checksummedAddress =
    recent.indexOf('mises') > -1 ? recent : safeToChecksumAddress(recent);
  return {
    type: 'ADD_RECENT',
    recent: checksummedAddress,
  };
}
