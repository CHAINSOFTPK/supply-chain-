import React from "react";
import { useEffect, useState } from "react";
import { Menu, Dropdown, Button } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { ETHLogo } from "./Logos";
import { useWeb3 } from "../../contexts/Web3Context";

const styles = {
  item: {
    display: "flex",
    alignItems: "center",
    height: "42px",
    fontWeight: "500",
    fontFamily: "Roboto, sans-serif",
    fontSize: "14px",
    padding: "0 10px",
  },
  button: {
    border: "2px solid rgb(231, 234, 243)",
    borderRadius: "12px",
  },
};

const menuItems = [
  {
    key: "0xaa36a7",
    value: "Sepolia Testnet",
    icon: <ETHLogo />,
  }
];

const Chains = () => {
  const { provider, chainId, switchChain } = useWeb3();
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!chainId) return null;
    const newSelected = menuItems.find((item) => item.key === chainId.toString(16));
    setSelected(newSelected);
    console.log("current chainId: ", chainId);
  }, [chainId]);

  const handleMenuClick = (e) => {
    console.log("switch to: ", e.key);
    switchChain(e.key);
  };

  const menu = (
    <Menu onClick={handleMenuClick}>
      {menuItems.map((item) => (
        <Menu.Item key={item.key} icon={item.icon} style={styles.item}>
          <span style={{ marginLeft: "5px" }}>{item.value}</span>
        </Menu.Item>
      ))}
    </Menu>
  );

  if (!chainId || !provider) return null;

  return (
    <div>
      <Dropdown overlay={menu} trigger={["click"]}>
        <Button
          key={selected?.key}
          icon={selected?.icon}
          style={{ ...styles.button, ...styles.item }}
        >
          <span style={{ marginLeft: "5px" }}>{selected?.value}</span>
          <DownOutlined />
        </Button>
      </Dropdown>
    </div>
  );
};

export default Chains;
