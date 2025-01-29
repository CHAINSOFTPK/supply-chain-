import { ethers } from 'ethers';
import { getEllipsisTxt } from "helpers/formatters";
import { getExplorer } from "helpers/networks";  // Add this import
import Blockie from "../Blockie";
import { Button, Card, Modal, Radio, Form, Input, notification, Menu } from "antd"; // Add Menu import
import { NavLink } from 'react-router-dom'; // Add NavLink import
import { useState, useEffect } from "react";
import Address from "../Address/Address";
import { SelectOutlined } from "@ant-design/icons";
import { useWeb3 } from '../../contexts/Web3Context';
import FarmerContract from "../../contracts/Farmer.json";
import DistContract from "../../contracts/Distributor.json";
import MenuItems from "../MenuItems"; // Add this import
import { connectors } from "./config"; // Import connectors from config.js
import MarketplaceContract from "../../contracts/DaliahMarketplace.json";
import { Typography } from 'antd';
const { Text } = Typography;

// Use contract addresses from JSON files
const FarmerContractAddress = FarmerContract.networks["11155111"].address;
const DistContractAddress = "0xe74f3FF590d09AC2Ae53851F2A5D19BF0Fe77035";
const MarketplaceContractAddress = MarketplaceContract.networks["11155111"]?.address;

// Add wallet connectors configuration
const styles = {
  account: {
    height: "42px",
    padding: "0 15px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "fit-content",
    borderRadius: "12px",
    backgroundColor: "rgb(244, 244, 244)",
    cursor: "pointer",
  },
  text: {
    color: "#21BF96",
  },
  connector: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    height: "auto",
    justifyContent: "center",
    marginLeft: "auto",
    marginRight: "auto",
    padding: "20px 5px",
    cursor: "pointer",
  },
  icon: {
    alignSelf: "center",
    fill: "rgb(40, 13, 95)",
    flexShrink: "0",
    marginBottom: "8px",
    height: "30px",
  },
};

function Account({ setRoleType }) {
  const { account, isAuthenticated, connect, disconnect, provider, chainId } = useWeb3();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [isRoleTypeModalVisible, setIsRoleTypeVisible] = useState(false);
  const [roleType, setRoleTypeState] = useState(); // Rename the state setter to avoid conflict

  const [fullName, setFullName] = useState();
  const [businessAddress, setBusinessAddress] = useState();
  const [isRegistered, setIsRegistered] = useState(false);

  const onClick = async (e) => {
    try {
      setRoleTypeState(e.target.value); // Use the renamed state setter
      setIsRoleTypeVisible(false);
    } catch (error) {
      console.error("Error setting role type:", error);
      notification.error({
        message: "Error",
        description: "Failed to set role type. Please try again.",
      });
    }
  };

  const openNotification = ({ message, description }) => {
    notification.open({
      placement: "bottomRight",
      message,
      description,
      icon: "🧑",
    });
  };

  const handleAuthenticate = async () => {
    await connect();
  };

  const logout = async () => {
    disconnect();
  };

  const checkRegistration = async (roleType) => {
    if (!provider) return false;
    try {
      const signer = provider.getSigner();
      let contract;
      
      if (roleType === "farmer") {
        contract = new ethers.Contract(FarmerContractAddress, FarmerContract.abi, signer);
      } else if (roleType === "distributor") {
        contract = new ethers.Contract(DistContractAddress, DistContract.abi, signer);
      }

      const isRegistered = await contract.hasProfile();
      if (isRegistered) {
        let profile;
        if (roleType === "farmer") { 
          profile = await contract.farmerProfiles(account);
          // Store farmer profile
          localStorage.setItem('userProfile', JSON.stringify({
            type: 'farmer',
            name: profile.farmerName,
            address: profile.farmerPhysicalAddress
          }));
        } else if (roleType === "distributor") {
          profile = await contract.distProfiles(account);
          // Store distributor profile
          localStorage.setItem('userProfile', JSON.stringify({
            type: 'distributor',
            name: profile.name,
            address: profile.physicalAddress
          }));
        }
        setFullName(profile.name || profile.farmerName);
        setBusinessAddress(profile.physicalAddress || profile.farmerPhysicalAddress);
      }
      return isRegistered;
    } catch (error) {
      console.error("Error checking registration:", error);
      return false;
    }
  };

  useEffect(() => {
    const checkUserRegistration = async () => {
      if (isAuthenticated && account) {
        const isFarmerRegistered = await checkRegistration("farmer");
        const isDistributorRegistered = await checkRegistration("distributor");
  
        if (isFarmerRegistered) {
          setRoleTypeState("farmer"); // Use the renamed state setter
          setIsRegistered(true);
        } else if (isDistributorRegistered) {
          setRoleTypeState("distributor"); // Use the renamed state setter
          setIsRegistered(true);
        }
      }
    };
  
    checkUserRegistration();
  }, [isAuthenticated, account]);

  const handleRegister = async (formData) => {
    if (!provider) return;
    try {
      const signer = provider.getSigner();
      let contract;

      // Instantiate correct contract
      if (roleType === "farmer") {
        contract = new ethers.Contract(
          FarmerContractAddress,
          FarmerContract.abi,
          signer
        );
      } else if (roleType === "distributor") {
        contract = new ethers.Contract(
          DistContractAddress,
          DistContract.abi,
          signer
        );
      } else {
        contract = new ethers.Contract(
          MarketplaceContractAddress,
          MarketplaceContract.abi,
          signer
        );
      }

      // Check registration
      const alreadyRegistered = await contract.hasProfile();
      if (alreadyRegistered) {
        notification.info({
          message: "Already Registered",
          description: `You are already registered as a ${roleType}`,
        });
        return;
      }

      // Execute registration transaction
      const tx = await contract.register(formData._name, formData._physicalAddress, {
        gasLimit: 3000000,
      });

      notification.info({
        message: "Transaction Sent",
        description: `Transaction hash: ${tx.hash}`,
      });

      const receipt = await tx.wait();

      notification.success({
        message: "Registration Successful",
        description: "Your account has been registered successfully",
      });

      setIsRegistered(true);
      setFullName(formData._name);
      setBusinessAddress(formData._physicalAddress);
    } catch (error) {
      console.error("Registration error:", error);
      notification.error({
        message: "Registration Failed",
        description: error.data?.message || error.message,
      });
    }
  };

  if (!isAuthenticated || !account) {
    return (
      <>
        <div onClick={connect}>
          <p style={styles.text}>Authenticate</p>
        </div>
        <Modal
          visible={isAuthModalVisible}
          footer={null}
          onCancel={() => setIsAuthModalVisible(false)}
          bodyStyle={{
            padding: "15px",
            fontSize: "17px",
            fontWeight: "500",
          }}
          style={{ fontSize: "16px", fontWeight: "500" }}
          width="340px"
        >
          <div
            style={{
              padding: "10px",
              display: "flex",
              justifyContent: "center",
              fontWeight: "700",
              fontSize: "20px",
            }}
          >
            Connect Wallet
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {connectors.map(({ title, icon, connectorId }, key) => (
              <div
                style={styles.connector}
                key={key}
                onClick={async () => {
                  try {
                    await connect();
                    window.localStorage.setItem("connectorId", connectorId);
                    setIsAuthModalVisible(false);
                  } catch (e) {
                    console.error("Authentication error:", e);
                    notification.error({
                      message: "Authentication Failed",
                      description: "Please check your wallet connection and try again."
                    });
                  }
                }}
              >
                <img src={icon} alt={title} style={styles.icon} />
                <Text style={{ fontSize: "14px" }}>{title}</Text>
              </div>
            ))}
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <div style={styles.account} onClick={() => setIsModalVisible(true)}>
        <p style={{ marginRight: '15px' }}>{getEllipsisTxt(account, 6)}</p>
        <Button type="primary">Account</Button>
      </div>
      {roleType === "farmer" && (
        <Menu mode="horizontal">
          <Menu.SubMenu key="registerHarvest" title="🧑‍🌾 Farmer">
            <Menu.ItemGroup title="Catalogue">
              <Menu.Item key="/registerStorage">
                <NavLink to="/registerCatalogue"> Register Catalogue</NavLink>
              </Menu.Item>
            </Menu.ItemGroup>
            <Menu.ItemGroup title="Harvest">
              <Menu.Item key="/registerHarvest">
                <NavLink to="/registerHarvest">Register Harvest</NavLink>
              </Menu.Item>
              <Menu.Item key="/browseHarvest">
                <NavLink to="/browseHarvest"> Browse Harvest</NavLink>
              </Menu.Item>
            </Menu.ItemGroup>
            <Menu.ItemGroup title="Orders">
              <Menu.Item key="farmer/orders">
                <NavLink to="/farmer/orders">Manage Orders</NavLink>
              </Menu.Item>
            </Menu.ItemGroup>
          </Menu.SubMenu>
        </Menu>
      )}
      {roleType === "distributor" && (
        <Menu mode="horizontal">
          <Menu.SubMenu key="distributor" title="📦 Distributor">
            <Menu.Item key="/orders">
              <NavLink to="/orders"> Manage Orders</NavLink>
            </Menu.Item>
            <Menu.Item key="/wallet">
              <NavLink to="/wallet"> Wallet</NavLink>
            </Menu.Item>
          </Menu.SubMenu>
        </Menu>
      )}
      {roleType === "carrier" && (
        <Menu mode="horizontal">
          <Menu.SubMenu key="carrier" title="🚚 Carrier">
            <Menu.Item key="/carrier/orders">
              <NavLink to="/carrier/orders"> Manage Orders</NavLink>
            </Menu.Item>
          </Menu.SubMenu>
        </Menu>
      )}
      <Modal
        visible={isModalVisible}
        footer={null}
        onCancel={() => setIsModalVisible(false)}
        bodyStyle={{
          padding: "15px",
          fontSize: "17px",
          fontWeight: "500",
        }}
        style={{ fontSize: "16px", fontWeight: "500" }}
        width="400px"
      >
        Account
        <Card
          style={{
            marginTop: "10px",
            borderRadius: "1rem",
          }}
          bodyStyle={{ padding: "15px" }}
        >
          <Address
            avatar="left"
            size={6}
            copyable
            style={{ fontSize: "20px" }}
          />
          <div style={{ marginTop: "10px", padding: "0 10px" }}>
            <a
              href={`${getExplorer(chainId)}/address/${account}`}
              target="_blank"
              rel="noreferrer"
            >
              <SelectOutlined style={{ marginRight: "5px" }} />
              View on Explorer
            </a>
          </div>
        </Card>
        {/* Step two of Auth: Account Type and account info */}
        {roleType && (
          <>
            <Card
              style={{
                marginTop: "10px",
                borderRadius: "1rem",
              }}
              bodyStyle={{ padding: "15px" }}
            >
              <b>Account Type:</b> {roleType}
            </Card>
          </>
        )}
        {!roleType && (
          <>
            Account Info
            <Card
              style={{
                marginTop: "10px",
                borderRadius: "1rem",
              }}
              bodyStyle={{ padding: "15px" }}
            >
              <div
                style={{
                  padding: "10px",
                  display: "flex",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "20px",
                }}
              >
                Choose Your Account Type:
              </div>

              <div
                style={{
                  padding: "10px",
                  display: "flex",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "20px",
                }}
              >
                <Radio.Group value={roleType} onChange={(e) => onClick(e)}>
                  <div style={{ padding: "5px", textAlign: "center" }}>
                    <Radio.Button
                      style={{ padding: "0px 90px" }}
                      value="customer"
                    >
                      Customer
                    </Radio.Button>
                  </div>
                  <br />
                  <Radio.Button value="farmer">Farmer</Radio.Button>
                  <Radio.Button value="distributor">Distributor</Radio.Button>
                  <Radio.Button value="carrier">Carrier</Radio.Button>
                </Radio.Group>
              </div>
            </Card>
          </>
        )}
        {/* Step three of Auth: Account Type and account info */}
        {!isRegistered && roleType !== "customer" && roleType !== "carrier" && (
          <>
            <Card
              style={{
                marginTop: "10px",
                borderRadius: "1rem",
              }}
              bodyStyle={{ padding: "15px" }}
            >
              <Form.Provider
                onFormFinish={async (name, { forms }) => {
                  const formData = forms[name].getFieldsValue();
                  await handleRegister(formData);
                }}
              >
                <Form layout="vertical" name="register">
                  <Form.Item
                    label="Full Name"
                    name="_name"
                    required
                    style={{ marginBottom: "15px" }}
                  >
                    <Input placeholder="Mohammed Ali" />
                  </Form.Item>

                  <Form.Item
                    label="Business Address"
                    name="_physicalAddress"
                    required
                    style={{ marginBottom: "15px" }}
                  >
                    <Input placeholder="Street Name, Bldg #6, Amman, Jordan" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit">
                    Register
                  </Button>
                </Form>
              </Form.Provider>
            </Card>
          </>
        )}
        {isRegistered && (
          <Card
            style={{
              marginTop: "10px",
              borderRadius: "1rem",
            }}
            bodyStyle={{ padding: "15px" }}
          >
            <div>
              <label>
                <b>Full Name:</b> {fullName}
              </label>
              <br />
              <label>
                <b>Business Address:</b> {businessAddress}
              </label>
            </div>
          </Card>
        )}
        <Button
          size="large"
          type="primary"
          style={{
            width: "100%",
            marginTop: "10px",
            borderRadius: "0.5rem",
            fontSize: "16px",
            fontWeight: "500",
          }}
          onClick={async () => {
            await logout();
            window.localStorage.removeItem("connectorId");
            setBusinessAddress("");
            setFullName("");
            setIsRegistered(false);
            setRoleTypeState(""); // Use the renamed state setter
            setIsModalVisible(false);
            window.location.reload()
          }}
        >
          Log out
        </Button>
      </Modal>
    </>
  );
}

export default Account;
