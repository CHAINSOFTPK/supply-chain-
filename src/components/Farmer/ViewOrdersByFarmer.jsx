import { Card, notification, Space, Table, Tag, Typography } from "antd";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";

const { Title } = Typography;

// Add utility functions
const safeNumberConversion = (value, defaultValue = 0) => {
  try {
    return value ? value.toNumber() : defaultValue;
  } catch (error) {
    console.warn('Error converting number:', error);
    return defaultValue;
  }
};

const safeFormatEther = (value) => {
  try {
    return value ? ethers.utils.formatEther(value) : '0';
  } catch (error) {
    console.warn('Error formatting ether value:', error);
    return '0';
  }
};

const getOrderStatus = (orderData) => {
  try {
    if (!orderData) return "UNKNOWN";
    if (orderData.isRefundApproved) return "REFUND_APPROVED";
    if (orderData.isCancelled) return "CANCELLED";
    
    const status = safeNumberConversion(orderData.isAccepted);
    switch (status) {
      case 0: return "PENDING_APPROVAL";
      case 1: return "ACCEPTED";
      case 2: return "REJECTED";
      default: return "UNKNOWN";
    }
  } catch (error) {
    console.warn('Error getting order status:', error);
    return "UNKNOWN";
  }
};

const getCarrierStatus = (orderData) => {
  try {
    if (!orderData.carrierAddress || 
        orderData.carrierAddress === ethers.constants.AddressZero) {
      return "CARRIER NOT INVITED";
    }
    if (orderData.carrier?.deliveredAt) return "DELIVERED";
    if (orderData.carrier?.pickupDate) return "ON THE WAY";
    return "WAITING PICKUP";
  } catch (error) {
    console.warn('Error getting carrier status:', error);
    return "UNKNOWN";
  }
};

// Add Pinata configuration
const projectId = "f5a3409d86e8aba5b4f4";
const projectSecret = "6ec243a8d51d845e08f9a363e6e0ca1b4ebac134a493e936814122bb3f3e154d";

export default function ViewOrdersByFarmer() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);

  const isDeployedToActiveChain = provider && contract?.networks?.[provider.network.chainId];

  const columns = [
    {
      title: "Order ID",
      dataIndex: "orderID",
      key: "orderID",
      render: (text) => <a>{text}</a>,
    },
    {
      title: "Order Status",
      key: "orderStatus",
      dataIndex: "orderStatus",
      render: (text) => {
        if (text === "ACCEPTED") {
          return <Tag color="success">{text}</Tag>;
        } else if (text === "REJECTED" || text === "CANCELLED") {
          return <Tag color="volcano">{text}</Tag>;
        } else {
          return <Tag color="geekblue">{text}</Tag>;
        }
      },
    },
    {
      title: "Harvest Type",
      dataIndex: "harvestType",
      key: "harvestType",
    },
    {
      title: "HBatch ID",
      dataIndex: "hbID",
      key: "hbID",
    },
    {
      title: "Quantity",
      dataIndex: "qty",
      key: "qty",
      render: (text) => <>{text} KG</>,
    },

    {
      title: "Total Order Price",
      dataIndex: "orderPrice",
      key: "orderPrice",
      render: (text) => <>{text + 25} JODT</>,
    },
    {
      title: "Net Amount",
      dataIndex: "orderPrice",
      key: "orderPrice",
      render: (text) => <>{text} JODT</>,
    },
    {
      title: "Shipping Status",
      key: "carrier",
      dataIndex: "carrier",
      render: (text) => {
        if (text == "DELIVERED") {
          return <Tag color="success">{text}</Tag>;
        } else if (text == "CARRIER NOT INVITED") {
          return <Tag color="volcano">{text}</Tag>;
        } else {
          return <Tag color="geekblue">{text}</Tag>;
        }
      },
    },

    {
      title: "Actions",
      key: "action",
      render: (_, record) => (
        <Space size="middle">
          <NavLink to={"/farmer/order/" + record.orderID}>Manage/View</NavLink>
        </Space>
      ),
    },
  ];

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      if (!provider || !account) {
        throw new Error("Web3 not initialized");
      }

      const signer = provider.getSigner();
      const chainId = provider.network.chainId;

      if (!DaliahMarketplace.networks[chainId]?.address || 
          !FarmerContract.networks[chainId]?.address) {
        throw new Error("Contracts not deployed on current network");
      }

      const marketplaceContract = new ethers.Contract(
        DaliahMarketplace.networks[chainId].address,
        DaliahMarketplace.abi,
        signer
      );

      const farmerContract = new ethers.Contract(
        FarmerContract.networks[chainId].address,
        FarmerContract.abi,
        signer
      );

      const orderCounter = await marketplaceContract.orderCounter();
      let orders = [];

      for (let i = 0; i < orderCounter; i++) {
        try {
          const orderData = await marketplaceContract.ordersMapping(i);
          
          // Check if the order belongs to current farmer
          if (orderData.farmerAddress && 
              orderData.farmerAddress.toLowerCase() === account.toLowerCase()) {

            // Get payment details
            const paymentData = await marketplaceContract.getOrderPaymentDeatils(i)
              .catch(() => [0, 0, 0, "UNKNOWN"]);

            // Get harvest data and product name
            let productName = "Unknown Product";
            let harvestData = null;

            try {
              if (orderData.productID) {
                harvestData = await farmerContract.harvestMapping(orderData.productID);
                
                if (harvestData?.catalogueProductID) {
                  const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
                    harvestData.catalogueProductID,
                    orderData.farmerAddress
                  );
                  if (catalogueItem?.[0]) {
                    productName = catalogueItem[0];
                  }
                }
              }
            } catch (error) {
              console.warn(`Error getting product details for order ${i}:`, error);
            }

            const orderItem = {
              key: i,
              orderID: i,
              harvestType: productName,
              hbID: safeNumberConversion(orderData.productID),
              orderPrice: safeFormatEther(orderData.totalPrice),
              qty: safeNumberConversion(orderData.quantity),
              orderStatus: getOrderStatus(orderData),
              carrier: getCarrierStatus(orderData),
              paymentStatus: paymentData?.[3] || "UNKNOWN"
            };

            orders.push(orderItem);
          }
        } catch (error) {
          console.warn(`Error processing order ${i}:`, error);
          continue;
        }
      }

      setResponses(orders);

    } catch (error) {
      console.error("Error fetching orders:", error);
      notification.error({
        message: "Error",
        description: error.message || "Failed to fetch orders"
      });
    } finally {
      setLoading(false);
    }
  };

  // Add this helper function for uploads
  const uploadToPinata = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': projectId,
          'pinata_secret_api_key': projectSecret,
        },
        body: formData
      });

      const data = await response.json();
      if (!data.IpfsHash) throw new Error('Failed to get IPFS hash');
      
      return data.IpfsHash;
    } catch (error) {
      console.error("Pinata upload error:", error);
      throw error;
    }
  };

  // Update useEffect to include proper dependency tracking and error handling
  useEffect(() => {
    if (provider && isAuthenticated && account) {
      console.log("Starting order fetch...");
      fetchOrders().catch(error => {
        console.error("Error in useEffect:", error);
        notification.error({
          message: "Error",
          description: "Failed to fetch orders"
        });
      });
    }
  }, [provider, isAuthenticated, account]);

  return (
    <div>
      {!isAuthenticated && (
        <center>Please authenticate to access this page.</center>
      )}

      {isDeployedToActiveChain && isAuthenticated && (
        <>
          <center>
            <Title>Browse Orders</Title>
          </center>
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
            <Table columns={columns} dataSource={responses} />
          </Card>
        </>
      )}
    </div>
  );
}
