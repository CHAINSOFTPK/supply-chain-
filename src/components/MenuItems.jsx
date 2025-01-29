import { useLocation } from "react-router";
import { Menu } from "antd";
import { NavLink } from "react-router-dom";
import { useEffect } from "react"; // Add this import
import {
  MailOutlined,
  AppstoreOutlined,
  SettingOutlined,
  AppleFilled,
} from "@ant-design/icons";

function MenuItems(props) {
  const { pathname } = useLocation();

  useEffect(() => {
    // Force re-render when roleType changes
  }, [props.roleType]);

  return (
    <Menu
      theme="light"
      mode="horizontal"
      style={{
        display: "flex",
        fontSize: "17px",
        fontWeight: "500",
        width: "100%",
        justifyContent: "center",
      }}
      defaultSelectedKeys={[pathname]}
    >
      <Menu.Item key="/home">
        <NavLink to="/home">🏠 Home</NavLink>
      </Menu.Item>
      {props.roleType === "farmer" && (
        <>
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
        </>
      )}

      <Menu.SubMenu key="marketplace" title="🛒 Marketplace">
        <Menu.Item key="/marketplace">
          <NavLink to="/marketplace">Marketplace</NavLink>
        </Menu.Item>
        {props.roleType === "distributor" && (
          <>
            <Menu.Item key="/orders">
              <NavLink to="/orders"> Manage Orders</NavLink>
            </Menu.Item>
            <Menu.Item key="/wallet">
              <NavLink to="/wallet"> Wallet</NavLink>
            </Menu.Item>
          </>
        )}
      </Menu.SubMenu>
      {props.roleType === "carrier" && (
        <>
          <Menu.SubMenu key="carrier" title="🚚 Carrier">
            <Menu.Item key="/carrier/orders">
              <NavLink to="/carrier/orders"> Manage Orders</NavLink>
            </Menu.Item>
          </Menu.SubMenu>
        </>
      )}

      <Menu.Item key="scanproduct">
        <NavLink to="/scanproduct">🔍 Scan Product</NavLink>
      </Menu.Item>
      <Menu.Item key="/erc20balance">
        <NavLink to="/erc20balance">🗄️ File a Report</NavLink>
      </Menu.Item>
    </Menu>
  );
}

export default MenuItems;
