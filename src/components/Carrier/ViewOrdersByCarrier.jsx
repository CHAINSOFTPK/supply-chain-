import { Card, notification, Space, Table, Tag, Typography } from "antd";
import { NavLink } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";

const { Title } = Typography;

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

export default function ViewOrdersByCarrier() {
  const { provider, account, isAuthenticated } = useWeb3();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(DaliahMarketplace);

  /** Returns true in case if contract is deployed to active chain in wallet */
  const isDeployedToActiveChain = useMemo(() => {
    if (!contract?.networks || !provider) return undefined;
    return [provider.network.chainId] in contract.networks;
  }, [contract, provider]);

  const contractAddress = useMemo(() => {
    if (!isDeployedToActiveChain || !provider) return null;
    return contract.networks[provider.network.chainId]?.["address"] || null;
  }, [provider, contract, isDeployedToActiveChain]);

  /** Default function for showing notifications*/
  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      icon: "🧑",
    });
  };

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
        if (text == "ACCEPTED") {
          return <Tag color="success">{text}</Tag>;
        } else if (text == "REJECTED") {
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
          <NavLink to={"/carrier/order/" + record.orderID}>Manage/View</NavLink>
        </Space>
      ),
    },
  ];
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const signer = provider.getSigner();
      
      const marketplaceContract = new ethers.Contract(
        contract.networks[provider.network.chainId].address,
        contract.abi,
        signer
      );
      
      const farmerContract = new ethers.Contract(
        FarmerContract.networks[provider.network.chainId].address,
        FarmerContract.abi,
        signer
      );
  
      // Get order counter
      const orderCounter = await marketplaceContract.orderCounter();
      let orders = [];
  
      for (let i = 0; i < orderCounter; i++) {
        try {
          const orderData = await marketplaceContract.ordersMapping(i);
          
          // Only process orders assigned to current carrier
          if (orderData.carrierAddress.toLowerCase() === account.toLowerCase()) {
            const harvestData = await farmerContract.harvestMapping(orderData.productID);
            
            // Safely get product name with proper error handling
            const harvestType = await getHarvestType(
              farmerContract,
              harvestData.catalogueProductID,
              harvestData.farmerAddress
            );
  
            orders.push({
              key: i,
              orderID: i,
              harvestType,
              hbID: safeNumberConversion(orderData.productID),
              orderPrice: safeFormatEther(orderData.totalPrice),
              qty: safeNumberConversion(orderData.quantity),
              carrier: addCarrierTags(orderData),
              orderStatus: addOrderTags(orderData),
              isRefundApproved: orderData.isRefundApproved || false
            });
          }
        } catch (error) {
          console.warn(`Error processing order ${i}:`, error);
          // Continue with next order if one fails
          continue;
        }
      }
      
      setResponses(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      notification.error({
        message: "Error",
        description: "Failed to fetch orders"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const getHarvestType = async (farmerContract, catalogueProductID, farmerAddress) => {
    try {
      if (!farmerContract || !catalogueProductID || 
          farmerAddress === ethers.constants.AddressZero) {
        return "Unknown Product";
      }
  
      // Get catalogue count first
      const catalogueCount = await farmerContract.getCatalogueItemsCount(farmerAddress);
      if (!catalogueCount || catalogueCount.isZero()) {
        return "Unknown Product";
      }
  
      // Make sure the index is valid
      const productIndex = safeNumberConversion(catalogueProductID);
      if (productIndex >= catalogueCount.toNumber()) {
        return "Unknown Product";
      }
  
      // Get catalogue item
      const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
        catalogueProductID,
        farmerAddress
      );
  
      return catalogueItem?.[0] || "Unknown Product";
    } catch (error) {
      console.warn("Error getting harvest type:", error);
      return "Unknown Product";
    }
  };
  
  const addCarrierTags = (orderData) => {
    try {
      if (!orderData.carrierAddress ||
          orderData.carrierAddress === ethers.constants.AddressZero) {
        return "CARRIER NOT INVITED";
      }
  
      // Check if carrier details exist
      if (!orderData.carrier?.carrierName) {
        return "WAITING ACCEPTANCE";
      }
  
      // Check delivered status first
      if (orderData.carrier.deliveredAt?.toString() !== "0") {
        return "DELIVERED";
      }
  
      // Check pickup status
      if (orderData.carrier.pickupDate?.toString() !== "0") {
        return "ON THE WAY";
      }
  
      // If carrier is assigned but hasn't picked up
      return "WAITING PICKUP";
    } catch (error) {
      console.warn("Error getting carrier status:", error);
      return "UNKNOWN";
    }
  };
  
  const addOrderTags = (order) => {
    try {
      if (order.isCancelled) return "CANCELLED";
      if (order.isRefundApproved) return "REFUND APPROVED";
      
      const status = safeNumberConversion(order.isAccepted);
      switch (status) {
        case 0: return "PENDING APPROVAL";
        case 1: return "ACCEPTED";
        case 2: return "REJECTED";
        default: return "UNKNOWN";
      }
    } catch (error) {
      console.warn("Error getting order status:", error);
      return "UNKNOWN";
    }
  };

  useEffect(() => {
    if (provider && isAuthenticated) {
      setLoading(true);
      fetchOrders();
    }
  }, [provider, isAuthenticated]);

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JOD",

    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
  });

  return (
    <div>
      {isAuthenticated === false && (
        <>
          <center>{`Please Authenticate to be able to access this page and try agan later.`}</center>
        </>
      )}

      {isDeployedToActiveChain === true && isAuthenticated === true && (
        <>
          <center>
            <Title>Manage Orders</Title>
          </center>
          <Card
            title={
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Current contract: {contract?.contractName}
                <Address
                  avatar="left"
                  copyable
                  address={contractAddress}
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
