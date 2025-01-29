import { Card, notification, Space, Table, Tag, Typography } from "antd";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import Address from "components/Address/Address";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from 'ethers';
import FarmerContract from "contracts/Farmer.json";
import DaliahMarketplace from "contracts/DaliahMarketplace.json";

const { Title } = Typography;

export default function ManageOrders() {
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
      render: (text) => {
        // Parse the original price from wei
        const priceInEther = parseFloat(text);
        // Add marketplace fee (25 JODT)
        const totalPrice = priceInEther + 25;
        return `${totalPrice.toFixed(2)} JODT`;
      },
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
          <NavLink to={"/order/" + record.orderID}>Manage/View</NavLink>
        </Space>
      ),
    },
  ];

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const signer = provider.getSigner();
      
      const marketplaceContract = new ethers.Contract(
        DaliahMarketplace.networks[provider.network.chainId].address,
        DaliahMarketplace.abi,
        signer
      );
      
      const farmerContract = new ethers.Contract(
        FarmerContract.networks[provider.network.chainId].address,
        FarmerContract.abi,
        signer
      );

      const orderCounter = await marketplaceContract.orderCounter();
      let orders = [];

      for (let i = 0; i < orderCounter; i++) {
        try {
          const orderData = await marketplaceContract.ordersMapping(i);
          
          if (orderData.distributorAddress.toLowerCase() === account.toLowerCase()) {
            // Get harvest data to calculate correct price
            const harvestData = await farmerContract.getHarvestData(orderData.productID);
            
            // Calculate total price correctly
            const pricePerKG = parseFloat(ethers.utils.formatEther(harvestData.pricePerKG));
            const quantity = orderData.quantity.toNumber();
            const totalPrice = (pricePerKG * quantity).toString();

            const order = {
              key: i,
              orderID: i,
              harvestType: await getHarvestType(farmerContract, harvestData),
              hbID: orderData.productID.toNumber(),
              qty: quantity,
              orderPrice: totalPrice, // Store raw price, formatting handled in column render
              orderStatus: getOrderStatus(orderData),
              carrier: getCarrierStatus(orderData)
            };

            console.log(`Order ${i} details:`, {
              pricePerKG,
              quantity,
              totalPrice,
              rawOrderData: orderData,
              formattedOrder: order
            });

            orders.push(order);
          }
        } catch (error) {
          console.error(`Error processing order ${i}:`, error);
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

  // Helper function to get harvest type
  const getHarvestType = async (farmerContract, harvestData) => {
    try {
      if (harvestData.farmerAddress === ethers.constants.AddressZero) {
        return "Unknown Product";
      }

      const catalogueCount = await farmerContract.getCatalogueItemsCount(harvestData.farmerAddress);
      if (harvestData.catalogueProductID.toNumber() >= catalogueCount) {
        return "Unknown Product";
      }

      const catalogueItem = await farmerContract.getCatalogueItemAtIndex(
        harvestData.catalogueProductID,
        harvestData.farmerAddress
      );
      return catalogueItem[0];
    } catch (error) {
      console.error("Error getting harvest type:", error);
      return "Unknown Product";
    }
  };

  const getOrderStatus = (orderData) => {
    try {
      if (orderData.isCancelled) return "CANCELLED";
      if (orderData.isRefundApproved) return "REFUND APPROVED";
      
      const status = orderData.isAccepted.toNumber();
      switch (status) {
        case 0: return "PENDING APPROVAL";
        case 1: return "ACCEPTED";
        case 2: return "REJECTED";
        default: return "UNKNOWN";
      }
    } catch (error) {
      console.error("Error getting order status:", error);
      return "UNKNOWN";
    }
  };

  const getCarrierStatus = (orderData) => {
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

  useEffect(() => {
    if (provider && isAuthenticated) {
      fetchOrders();
    }
  }, [provider, isAuthenticated]);

  return (
    <div>
      {!isAuthenticated && (
        <center>Please authenticate to access this page.</center>
      )}
      
      {isDeployedToActiveChain && isAuthenticated && (
        <>
          <center>
            <Title>Manage Orders</Title>
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
