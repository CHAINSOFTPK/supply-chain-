import { Skeleton } from "antd";
import { useEffect, useState } from "react";
import makeBlockie from 'ethereum-blockies-base64';
import { useWeb3 } from '../contexts/Web3Context';

/**
 * Shows a blockie image for the provided wallet address
 * @param {*} props
 * @returns <Blockies> JSX Element
 */

function Blockie(props) {
  const { account } = useWeb3();
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    const address = props.currentWallet ? account : props.address;
    if (address) {
      try {
        const src = makeBlockie(address.toLowerCase());
        setImgSrc(src);
      } catch (error) {
        console.error("Error generating blockie:", error);
      }
    }
  }, [account, props.address, props.currentWallet]);

  if (!props.address && (!account || !imgSrc)) {
    return <Skeleton.Avatar active size={40} />;
  }

  return (
    <img 
      src={imgSrc}
      alt="blockie"
      className="identicon"
      height={props.size}
      width={props.size}
      {...props}
    />
  );
}

export default Blockie;
