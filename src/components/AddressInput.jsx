import { useCallback, useEffect, useRef, useState } from "react";
import { getEllipsisTxt } from "../helpers/formatters";
import Blockie from "./Blockie";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ethers } from 'ethers';
import { useWeb3 } from "../contexts/Web3Context";

function AddressInput(props) {
  const input = useRef(null);
  const { provider } = useWeb3();
  const [address, setAddress] = useState("");
  const [validatedAddress, setValidatedAddress] = useState("");
  const [isDomain, setIsDomain] = useState(false);

  useEffect(() => {
    if (validatedAddress) props.onChange(isDomain ? validatedAddress : address);
  }, [props, validatedAddress, isDomain, address]);

  const updateAddress = useCallback(
    async (value) => {
      setAddress(value);
      if (isSupportedDomain(value)) {
        try {
          if (value.endsWith(".eth")) {
            const resolvedAddress = await provider.resolveName(value);
            if (resolvedAddress) {
              setValidatedAddress(resolvedAddress);
              setIsDomain(true);
            } else {
              setValidatedAddress("");
              setIsDomain(false);
            }
          }
        } catch (error) {
          console.error("Error resolving ENS name:", error);
          setValidatedAddress("");
          setIsDomain(false);
        }
      } else if (ethers.utils.isAddress(value)) {
        setValidatedAddress(getEllipsisTxt(value, 10));
        setIsDomain(false);
      } else {
        setValidatedAddress("");
        setIsDomain(false);
      }
    },
    [provider]
  );

  const Cross = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="#E33132"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      onClick={() => {
        setValidatedAddress("");
        setIsDomain(false);
        setTimeout(function () {
          input.current.focus();
        });
      }}
      style={{ cursor: "pointer" }}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  return (
    <Input
      ref={input}
      size="large"
      placeholder={props.placeholder ? props.placeholder : "Public address"}
      prefix={
        isDomain || ethers.utils.isAddress(address) ? (
          <Blockie
            address={(isDomain ? validatedAddress : address).toLowerCase()}
            size={8}
            scale={3}
          />
        ) : (
          <SearchOutlined />
        )
      }
      suffix={validatedAddress && <Cross />}
      autoFocus={props.autoFocus}
      value={
        isDomain
          ? `${address} (${getEllipsisTxt(validatedAddress)})`
          : validatedAddress || address
      }
      onChange={(e) => {
        updateAddress(e.target.value);
      }}
      disabled={validatedAddress}
      style={
        validatedAddress
          ? { ...props?.style, border: "1px solid rgb(33, 191, 150)" }
          : { ...props?.style }
      }
    />
  );
}

function isSupportedDomain(domain) {
  // For now, only supporting ENS domains
  return domain.endsWith(".eth");
}

export default AddressInput;
