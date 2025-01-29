import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { notification } from 'antd'; // Ensure notification is imported

const Web3Context = createContext(null);

const ALCHEMY_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/oPUEoLfWFg9F26HKqIu1WeGYqKVdxQRD";

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roleType, setRoleType] = useState(null);

  const switchChain = async (chainIdHex) => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
        notification.success({
          message: "Network Changed",
          description: "Successfully switched network",
        });
      } catch (error) {
        notification.error({
          message: "Error",
          description: "Failed to switch network",
        });
      }
    }
  };

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        // Use Alchemy provider as fallback
        const fallbackProvider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL);
        const provider = new ethers.providers.Web3Provider(window.ethereum, {
          chainId: 11155111, // Sepolia
          name: 'Sepolia',
          ensAddress: null,
          _defaultProvider: (providers) => fallbackProvider
        });
        
        setProvider(provider);

        // Get initial chainId
        const network = await provider.getNetwork();
        setChainId(network.chainId);

        // Check if we're on Sepolia
        if (network.chainId !== 11155111) { // Sepolia chainId
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }], // Sepolia chainId in hex
            });
            notification.success({
              message: "Network Switched",
              description: "Successfully switched to Sepolia testnet.",
            });
          } catch (error) {
            notification.error({
              message: "Wrong Network",
              description: "Please switch to Sepolia testnet.",
            });
            return;
          }
        }

        // Get initial account
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsAuthenticated(true);
        }

        // Get initial network
        const updatedNetwork = await provider.getNetwork();
        setChainId(updatedNetwork.chainId);

        // Add console logs for debugging
        console.log("Provider initialized:", provider);
        console.log("Initial accounts:", accounts);
        console.log("Initial network:", updatedNetwork);

        // Setup listeners
        window.ethereum.on('accountsChanged', (accounts) => {
          console.log("Accounts changed:", accounts);
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsAuthenticated(true);
          } else {
            setAccount(null);
            setIsAuthenticated(false);
          }
        });

        window.ethereum.on('chainChanged', (chainIdHex) => {
          const newChainId = parseInt(chainIdHex, 16);
          setChainId(newChainId);
          console.log("Chain changed:", newChainId);
          if (newChainId !== 11155111) {
            notification.error({
              message: "Wrong Network",
              description: "Please switch to Sepolia testnet",
            });
            setIsAuthenticated(false);
          }
          setChainId(newChainId);
        });
      }
    };

    initWeb3();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, []);

  const connect = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsAuthenticated(true);
          notification.success({
            message: "Connected",
            description: "Wallet connected successfully.",
          });
        }
      } catch (error) {
        console.error("Error connecting to MetaMask", error);
        notification.error({
          message: "Connection Failed",
          description: "Please check your wallet connection and try again.",
        });
      }
    }
  };

  const disconnect = () => {
    setAccount(null);
    setIsAuthenticated(false);
    notification.info({
      message: "Disconnected",
      description: "Wallet disconnected.",
    });
  };

  return (
    <Web3Context.Provider value={{
      provider,
      account,
      chainId,  // Make sure chainId is included here
      isAuthenticated,
      connect,
      disconnect,
      roleType,
      setRoleType,
      switchChain
    }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};
