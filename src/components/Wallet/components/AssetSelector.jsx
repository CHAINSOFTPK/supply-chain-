import { useState, useEffect, useMemo } from "react";
import { Image, Select } from "antd";
import { useWeb3 } from "../../../contexts/Web3Context";
import { ethers } from 'ethers';

// ERC20 ABI for balanceOf and decimals functions
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export default function AssetSelector({ setAsset, style }) {
  const { provider, account } = useWeb3();
  const [assets, setAssets] = useState([]);
  const [nativeBalance, setNativeBalance] = useState(null);

  // Fetch ERC20 token balances
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!provider || !account) return;

      try {
        // Get native balance
        const ethBalance = await provider.getBalance(account);
        setNativeBalance({
          balance: ethBalance,
          decimals: 18,
          name: "Ethereum",
          symbol: "ETH",
          token_address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        });

        // Here you would add your known token addresses
        const tokenAddresses = [
          // Add your token contract addresses here
        ];

        const tokenPromises = tokenAddresses.map(async (address) => {
          const contract = new ethers.Contract(address, ERC20_ABI, provider);
          const [balance, decimals, symbol, name] = await Promise.all([
            contract.balanceOf(account),
            contract.decimals(),
            contract.symbol(),
            contract.name()
          ]);

          return {
            balance: balance.toString(),
            decimals,
            name,
            symbol,
            token_address: address,
          };
        });

        const tokens = await Promise.all(tokenPromises);
        setAssets(tokens);

      } catch (error) {
        console.error("Error fetching token balances:", error);
      }
    };

    fetchTokenBalances();
  }, [provider, account]);

  const fullBalance = useMemo(() => {
    if (!assets || !nativeBalance) return null;
    return [
      ...assets,
      nativeBalance
    ];
  }, [assets, nativeBalance]);

  function handleChange(value) {
    const token = fullBalance.find((token) => token.token_address === value);
    setAsset(token);
  }

  return (
    <Select onChange={handleChange} size="large" style={style}>
      {fullBalance && fullBalance.map((item) => (
        <Select.Option
          value={item.token_address}
          key={item.token_address}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: "8px",
          }}>
            <Image
              src="https://etherscan.io/images/main/empty-token.png"
              alt="nologo"
              width="24px"
              height="24px"
              preview={false}
              style={{ borderRadius: "15px" }}
            />
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              width: "90%",
            }}>
              <p>{item.symbol}</p>
              <p style={{ alignSelf: "right" }}>
                ({ethers.utils.formatUnits(item.balance, item.decimals)})
              </p>
            </div>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
}
