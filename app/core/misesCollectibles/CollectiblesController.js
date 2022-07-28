import { CollectiblesController, NetworksChainId } from '@metamask/controllers';
import { getBaseApi, request } from '../misesController/misesNetwork.util';

export default class MisesCollectiblesController extends CollectiblesController {
  constructor(options, config, state) {
    super(options, config, state);
    this.getMisesAccount = options.getMisesAccount;
  }

  getNetwork() {
    const { chainId } = this.config;
    if (chainId === NetworksChainId.mainnet) {
      return 'main';
    }
    if (chainId === NetworksChainId.rinkeby) {
      return 'test';
    }
    return 'unknown';
  }

  getCollectibleApi(contractAddress, tokenId) {
    // const { chainId } = this.config;
    return `${getBaseApi(
      'single_asset',
    )}?asset_contract_address=${contractAddress}&token_id=${tokenId}&network=${this.getNetwork()}`;
  }

  getCollectibleContractInformationApi(contractAddress) {
    return `${getBaseApi(
      'assets_contract',
    )}?asset_contract_address=${contractAddress}&network=${this.getNetwork()}`;
  }

  /**
   * Checks the ownership of a ERC-721 or ERC-1155 collectible for a given address.
   *
   * @param ownerAddress - User public address.
   * @param collectibleAddress - Collectible contract address.
   * @param collectibleId - Collectible token ID.
   * @returns Promise resolving the collectible ownership.
   */
  async isCollectibleOwner(ownerAddress, collectibleAddress, collectibleId) {
    // Checks the ownership for ERC-721.
    try {
      const owner = await this.getERC721OwnerOf(
        collectibleAddress,
        collectibleId,
      );
      // If the owner contract address of the current collectibleAddress returns 0x, it is considered not the current owner Continue with the getERC1155BalanceOf function
      if (owner.toLowerCase() !== '0x') {
        return ownerAddress.toLowerCase() === owner.toLowerCase();
      }
      // eslint-disable-next-line no-empty
    } catch (_a) {
      // Ignore ERC-721 contract error
      console.warn(_a, 'isCollectibleOwner');
    }
    // Checks the ownership for ERC-1155.
    try {
      const balance = await this.getERC1155BalanceOf(
        ownerAddress,
        collectibleAddress,
        collectibleId,
      );
      return balance > 0;
      // eslint-disable-next-line no-empty
    } catch (_b) {
      // Ignore ERC-1155 contract error
    }
    throw new Error(
      'Unable to verify ownership. Probably because the standard is not supported or the chain is incorrect.',
    );
  }

  /**
   * Request individual collectible information from OpenSea API.
   *
   * @param contractAddress - Hex address of the collectible contract.
   * @param tokenId - The collectible identifier.
   * @returns Promise resolving to the current collectible name and image.
   */
  async getCollectibleInformationFromApi(contractAddress, tokenId) {
    try {
      const tokenURI = this.getCollectibleApi(contractAddress, tokenId);
      const misesAccount = this.getMisesAccount()[contractAddress];
      const collectibleInformation = await request({
        url: tokenURI,
        method: 'GET',
        headers: {
          // 'X-API-KEY': this.openSeaApiKey,
          Authorization: `Bearer ${misesAccount.token}`,
        },
        isCustom: true,
      });
      const {
        num_sales: numSales,
        background_color: backgroundColor,
        image_url: imageUrl,
        image_preview_url: imagePreviewUrl,
        image_thumbnail_url: imageThumbnailUrl,
        image_original_url: imageOriginalUrl,
        animation_url: animationUrl,
        animation_original_url: animationOriginalUrl,
        name,
        description,
        external_link: externalLink,
        creator,
        last_sale: lastSale,
        asset_contract: { schema_name: schemaName },
      } = collectibleInformation;
      /* istanbul ignore next */
      const collectibleMetadata = {
        name: name || null,
        description: description || null,
        image: imageUrl || null,
        ...(creator && { creator }),
        ...(numSales && { numberOfSales: numSales }),
        ...(backgroundColor && { backgroundColor }),
        ...(imagePreviewUrl && { imagePreview: imagePreviewUrl }),
        ...(imageThumbnailUrl && { imageThumbnail: imageThumbnailUrl }),
        ...(imageOriginalUrl && { imageOriginal: imageOriginalUrl }),
        ...(animationUrl && { animation: animationUrl }),
        ...(animationOriginalUrl && {
          animationOriginal: animationOriginalUrl,
        }),
        ...(externalLink && { externalLink }),
        ...(lastSale && { lastSale }),
        ...(schemaName && { standard: schemaName }),
      };
      return collectibleMetadata;
    } catch (error) {
      return error;
    }
  }

  /**
   * Request collectible contract information from OpenSea API.
   *
   * @param contractAddress - Hex address of the collectible contract.
   * @returns Promise resolving to the current collectible name and image.
   */
  getCollectibleContractInformationFromApi(contractAddress) {
    const misesAccount = this.getMisesAccount()[contractAddress];
    if (!misesAccount?.token) {
      return Promise.resolve(new Error('No token found'));
    }
    return request({
      url: this.getCollectibleContractInformationApi(contractAddress),
      method: 'GET',
      headers: {
        // 'X-API-KEY': this.openSeaApiKey,
        Authorization: `Bearer ${misesAccount.token}`,
      },
      isCustom: true,
    });
  }
}
