import { notification } from 'antd';

export const networkConfigs = {
  "0xaa36a7": {
    chainId: 11155111,
    chainName: "Sepolia",
    currencyName: "ETH",
    currencySymbol: "ETH",
    rpcUrl: "https://sepolia.infura.io/v3/c0252cb29abc45dcb4af6b1d2e281444",
    blockExplorerUrl: "https://sepolia.etherscan.io/",
  },
};

export const getNativeByChain = (chain) =>
  networkConfigs[chain]?.currencySymbol || "NATIVE";

export const getChainById = (chain) => networkConfigs[chain]?.chainId || null;

export const getExplorer = (chainId) => {
  if (!chainId) return "https://sepolia.etherscan.io";
  
  const chainIdHex = chainId.toString(16);
  return networkConfigs[chainIdHex]?.blockExplorerUrl || "https://sepolia.etherscan.io";
};

export const getWrappedNative = (chain) =>
  networkConfigs[chain]?.wrapped || null;

export const SEPOLIA_CHAIN_ID = 11155111;

export const checkNetwork = async (provider) => {
  const network = await provider.getNetwork();
  return network.chainId === SEPOLIA_CHAIN_ID;
};

export const switchToSepolia = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }], // Sepolia chainId in hex
    });
    notification.success({
      message: "Network Switched",
      description: "Successfully switched to Sepolia testnet.",
    });
    return true;
  } catch (error) {
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            },
          ],
        });
        notification.success({
          message: "Network Added",
          description: "Sepolia testnet added successfully.",
        });
        return true;
      } catch (addError) {
        console.error('Error adding Sepolia network:', addError);
        notification.error({
          message: "Add Network Failed",
          description: "Failed to add Sepolia testnet.",
        });
        return false;
      }
    }
    console.error('Error switching to Sepolia:', error);
    notification.error({
      message: "Switch Network Failed",
      description: "Failed to switch to Sepolia testnet.",
    });
    return false;
  }
};
