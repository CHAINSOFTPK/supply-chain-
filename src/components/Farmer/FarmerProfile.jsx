import { Card, notification, Badge, Descriptions, Image } from "antd";
import { useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import FarmerContract from "contracts/Farmer.json";

export default function FarmerProfile() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(FarmerContract);

  const isDeployedToActiveChain = provider && contract?.networks?.[provider.network.chainId];

  const fetchHarvestMapping = async () => {
    try {
      setLoading(true);
      const signer = provider.getSigner();
      const farmerContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );

      const harvestCount = await farmerContract.harvestCounter();
      let harvests = [];

      for (let i = 0; i < harvestCount; i++) {
        const harvestData = await farmerContract.harvestMapping(i);
        
        if (harvestData.farmerAddress.toLowerCase() === account.toLowerCase()) {
          const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
            harvestData.catalogueProductID,
            harvestData.farmerAddress
          );

          harvests.push({
            harvestID: i,
            productName: catalogueItem[0],
            volume: catalogueItem[1].toNumber(),
            catImageUrl: `https://ipfs.io/ipfs/${catalogueItem[2]}`,
            ECLevel: harvestData.ECLevel.toNumber() / 1000,
            PHLevel: harvestData.PHLevel.toNumber() / 1000,
            waterLevel: harvestData.waterLevel.toNumber() / 1000,
            expiryDate: new Date(harvestData.expiryDate.toNumber() * 1000),
            farmerAddress: harvestData.farmerAddress,
            harvestCaptureDate: new Date(harvestData.harvestCaptureDate.toNumber() * 1000),
            minOrderQty: harvestData.minOrderQty.toNumber(),
            harvestPhotoUrl: `https://ipfs.io/ipfs/${harvestData.photoHash}`,
            pricePerKG: ethers.utils.formatEther(harvestData.pricePerKG),
            qty: harvestData.quantity.toNumber(),
          });
        }
      }
      setResponses(harvests);
    } catch (error) {
      console.error("Error fetching harvests:", error);
      notification.error({
        message: "Error",
        description: "Failed to fetch harvest data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider && isAuthenticated) {
      fetchHarvestMapping();
    }
  }, [provider, isAuthenticated]);

  const isExpired = (date) => {
    return new Date().getTime() > date.getTime();
  };

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JOD",
  });

  return (
    <div>
      {!isDeployedToActiveChain && (
        <>{`The contract is not deployed to the active chain. Please switch to the correct network.`}</>
      )}
      
      {isDeployedToActiveChain && (
        <Card
          title={
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              Current contract: {contract?.contractName}
              <Address
                avatar="left"
                copyable
                address={contract.networks[provider.network.chainId].address}
                size={8}
              />
            </div>
          }
          size="large"
          loading={loading}
        >
          {responses.map((harvest, key) => (
            <Card
              key={key}
              title={`HarvestID: ${harvest.harvestID}`}
              size="large"
              style={{ margin: "10px 0px" }}
            >
              <Descriptions title="Product Data" bordered>
                {/* ... existing Descriptions.Items ... */}
                <Descriptions.Item label="Product Name">
                  {harvest.productName}
                </Descriptions.Item>
                <Descriptions.Item label="Farmer Address">
                  <Address
                    size="8"
                    avatar="left"
                    copyable
                    address={harvest.farmerAddress}
                  />
                </Descriptions.Item>
                {/* ... rest of the descriptions ... */}
                <Descriptions.Item label="Harvest Photos">
                  <Image.PreviewGroup>
                    <Image width={100} src={harvest.catImageUrl} />
                    <Image width={100} src={harvest.harvestPhotoUrl} />
                  </Image.PreviewGroup>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ))}
        </Card>
      )}
    </div>
  );
}
