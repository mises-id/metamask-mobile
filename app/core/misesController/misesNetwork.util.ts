export const MISES_SITE_API = 'https://api.alb.mises.site/api/v1';
// export const MISES_SITE_API = 'http://192.168.1.2:8080/api/v1';
// export const MISES_POINT = 'http://192.168.1.8:26657';
export const MISES_POINT = 'http://127.0.0.1:26657';
// mises network api map
export enum misesAPi {
  signin = 'signin',
  gasprices = 'gasprices',
  assets = 'assets',
  single_asset = 'single_asset',
  assets_contract = 'assets_contract',
}
export const getBaseApi = (type: misesAPi) => {
  switch (type) {
    case misesAPi.signin: // get api token
      return `${MISES_SITE_API}/signin`;
    case misesAPi.gasprices: // get gasprices
      return `${MISES_SITE_API}/mises/gasprices`;
    case misesAPi.assets:
      return `${MISES_SITE_API}/opensea/assets`;
    case misesAPi.single_asset:
      return `${MISES_SITE_API}/opensea/single_asset`;
    case misesAPi.assets_contract:
      return `${MISES_SITE_API}/opensea/assets_contract`;
    default:
      throw new Error('getBaseApi requires an api call type');
  }
};
interface requestOptions {
  url: string;
  method?: 'get' | 'post' | 'delete' | 'pust';
  body?: any;
  params?: any;
  headers?: any;
  isCustom?: boolean;
}
export function request(options: requestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    fetch(options.url, {
      method: options.method || 'get',
      body: JSON.stringify(options.body || options.params),
      headers: options.headers || {
        'Content-Type': 'application/json;charset=utf-8',
      },
    })
      .then(async (response) => {
        if (response.status === 200) {
          const res = await response.json();
          if (options.isCustom) {
            resolve(res);
          }
          res.code === 0 ? resolve(res.data) : reject(res.message);
        } else {
          reject(response.statusText);
        }
      })
      .catch(reject);
  });
}
/**
 * Shortens an Ethereum address for display, preserving the beginning and end.
 * Returns the given address if it is no longer than 10 characters.
 * Shortened addresses are 13 characters long.
 *
 * Example output: 0xabcd...1234
 *
 * @param {string} address - The address to shorten.
 * @returns {string} The shortened address, or the original if it was no longer
 * than 10 characters.
 */
// The character limit on ENS names, nicknames and addresses before we truncate
export const TRUNCATED_NAME_CHAR_LIMIT = 11;

// The number of characters to slice from the beginning of an address for truncated format:
// `${TRUNCATED_ADDRESS_START_CHARS}...${TRUNCATED_ADDRESS_END_CHARS}`
export const TRUNCATED_ADDRESS_START_CHARS = 5;

// The number of characters to slice from the end of an address for truncated format:
// `${TRUNCATED_ADDRESS_START_CHARS}...${TRUNCATED_ADDRESS_END_CHARS}`
export const TRUNCATED_ADDRESS_END_CHARS = 4;

export const MISES_TRUNCATED_ADDRESS_START_CHARS = 8;
export function shortenAddress(
  address = '',
  prefix = TRUNCATED_ADDRESS_START_CHARS,
) {
  if (address.length < TRUNCATED_NAME_CHAR_LIMIT) {
    return address;
  }

  return `${address.slice(0, prefix)}...${address.slice(
    -TRUNCATED_ADDRESS_END_CHARS,
  )}`;
}
