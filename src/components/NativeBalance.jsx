import { useState, useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';

function NativeBalance(props) {
  const { provider, account, isAuthenticated } = useWeb3();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const getBalance = async () => {
      if (provider && account) {
        try {
          const balance = await provider.getBalance(account);
          setBalance(ethers.utils.formatEther(balance));
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance(null);
        }
      }
    };

    getBalance();

    // Set up listener for block changes to update balance
    if (provider) {
      provider.on('block', getBalance);
      return () => {
        provider.removeListener('block', getBalance);
      };
    }
  }, [provider, account]);

  if (!account || !isAuthenticated || !balance) return null;

  return (
    <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
      {balance} ETH
    </div>
  );
}

export default NativeBalance;
