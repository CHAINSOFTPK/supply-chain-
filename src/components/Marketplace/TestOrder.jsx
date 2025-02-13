import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../contexts/Web3Context';
import DaliahMarketplace from 'contracts/DaliahMarketplace.json';
import JordanainDinarToken from 'contracts/JordanainDinarToken.json';
import Farmer from 'contracts/Farmer.json';
import Distributor from 'contracts/Distributor.json';

export default function TestOrder() {
  const { provider, account } = useWeb3();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [farmerAddress, setFarmerAddress] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get contract addresses from JSON files
  const marketplaceAddress = DaliahMarketplace.networks["11155111"]?.address;
  const tokenAddress = JordanainDinarToken.networks["11155111"]?.address;
  const farmerContractAddress = Farmer.networks["11155111"]?.address;
  const distributorContractAddress = "0xf26CeEe62C957209d5146De0a7C21BC9AA68bDf5";
  const additionalApprovalAddress = "0x7220DCb301c2ADCeEb01bA6ada4A567838A6B195";

  console.log("Contract Addresses:", {
    marketplace: marketplaceAddress,
    token: tokenAddress,
    farmer: farmerContractAddress,
    distributor: distributorContractAddress
  });

  // Verify addresses are available
  if (!marketplaceAddress || !tokenAddress || !farmerContractAddress || !distributorContractAddress) {
    console.error("Missing contract addresses");
  }

  const handlePlaceOrder = async () => {
    try {
      if (!provider || !account) {
        setError("Please connect with Metamask");
        return;
      }

      setLoading(true);
      setError('');
      setSuccess('');

      const signer = provider.getSigner();
      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        DaliahMarketplace.abi,
        signer
      );

      if (!productId || !quantity || !farmerAddress) {
        throw new Error("Please enter product ID, quantity, and farmer address");
      }
      
      // Convert inputs to numbers
      const productIDInt = parseInt(productId);
      const quantityInt = parseInt(quantity);
      if (isNaN(productIDInt) || isNaN(quantityInt)) {
        throw new Error("Invalid product ID or quantity");
      }

      const tokenContract = new ethers.Contract(
        tokenAddress,
        JordanainDinarToken.abi,
        signer
      );

      // Use numeric values in getOrderTotalPrice
      const totalPrice = await marketplaceContract.getOrderTotalPrice(productIDInt, quantityInt);
      
      // Add fee of 25 tokens (assumes 18 decimals) to the approval amount only.
      const fee = ethers.utils.parseUnits("25", 18);
      const totalApproval = totalPrice.add(fee);
      
      // Log the approved token amount for debugging
      console.log("Approving tokens (wei):", totalApproval.toString());
      console.log("Approving tokens (formatted):", ethers.utils.formatUnits(totalApproval, 18));

      // Approve for marketplace contract
      const approveTx1 = await tokenContract.approve(marketplaceAddress, totalApproval);
      await approveTx1.wait();

      // Also approve for additional contract
      console.log("Approving tokens for additional contract:", additionalApprovalAddress);
      const approveTx2 = await tokenContract.approve(additionalApprovalAddress, totalApproval);
      await approveTx2.wait();

      // Call placeOrder with original parameters (without fee)
      const tx = await marketplaceContract.placeOrder(
        productIDInt,
        quantityInt,
        farmerAddress,
        {
          gasLimit: 500000
        }
      );

      await tx.wait();
      setSuccess('Order placed successfully!');
    } catch (err) {
      console.error('Error placing order:', err);
      setError(err.message || 'Error placing order');
    } finally {
      setLoading(false);
    }
  };

  // New function for automatic testing using fixed parameters and distributor private key
  const handleAutoTest = async () => {
    const testProductId = 7;
    const testQuantity = 1;
    const testFarmerAddress = "0xc73e2c7d68764b6df4339904c90805e8ef743d7c";
    const distributorPrivateKey = "a8a2cc7c5ded5d43962649aeedff6d43b6c1e9c42e9b1ebefc8fdd0ac6bb440c";
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const wallet = new ethers.Wallet(distributorPrivateKey, provider);
      console.log("Distributor wallet address:", wallet.address);

      // Check distributor contract address
      console.log("Distributor contract address:", distributorContractAddress);

      // Create distributor contract instance
      const distributorContract = new ethers.Contract(
        distributorContractAddress,
        Distributor.abi,
        wallet
      );

      try {
        // Log the ABI of the hasProfile function
        console.log("Checking distributor profile...");
        
        // Try to read the contract code to verify it exists
        const code = await provider.getCode(distributorContractAddress);
        console.log("Contract code exists:", code !== "0x");

        const isRegistered = await distributorContract.hasProfile();
        console.log("Is distributor registered:", isRegistered);
        
        if (!isRegistered) {
          console.log("Registering distributor profile...");
          const registerTx = await distributorContract.register(
            "Test Distributor",
            "Test Distributor Address",
            { 
              gasLimit: 500000,
              gasPrice: await provider.getGasPrice()
            }
          );
          console.log("Registration transaction sent:", registerTx.hash);
          await registerTx.wait();
          console.log("Distributor profile registered");
        } else {
          console.log("Distributor already registered");
        }
      } catch (err) {
        console.error("Distributor contract error details:", {
          error: err,
          contractAddress: distributorContractAddress,
          walletAddress: wallet.address,
          errorName: err.name,
          errorMessage: err.message,
          errorCode: err.code
        });
        throw new Error(`Distributor contract error: ${err.message}`);
      }

      // Continue with order placement
      const marketplaceContract = new ethers.Contract(
        marketplaceAddress,
        DaliahMarketplace.abi,
        wallet
      );
      const tokenContract = new ethers.Contract(
        tokenAddress,
        JordanainDinarToken.abi,
        wallet
      );

      // Get exact total price
      const totalPrice = await marketplaceContract.getOrderTotalPrice(testProductId, testQuantity);
      console.log("Total price in wei:", totalPrice.toString());
      console.log("Total price in JOD:", ethers.utils.formatUnits(totalPrice.toString(), 18));
      
      // Add fee of 25 tokens (assumes 18 decimals) for approval only.
      const fee = ethers.utils.parseUnits("25", 18);
      const totalApproval = totalPrice.add(fee);

      // Log the approved token amount for debugging
      console.log("Approving tokens (wei):", totalApproval.toString());
      console.log("Approving tokens (formatted):", ethers.utils.formatUnits(totalApproval, 18));

      // Get fresh nonce for approve transaction
      let nonce = await wallet.getTransactionCount("latest");
      console.log("Current nonce:", nonce);

      // First transaction: Approve with additional fee
      const approveTx1 = await tokenContract.approve(
        marketplaceAddress, 
        totalApproval,
        { 
          nonce: nonce,
          gasLimit: 100000
        }
      );
      console.log("Approval transaction sent, waiting for confirmation...");
      await approveTx1.wait();
      console.log("Approval confirmed");

      // Increase nonce and approve for additional contract
      nonce = nonce + 1;
      console.log("Approving for additional contract with nonce:", nonce);
      const approveTx2 = await tokenContract.approve(
        additionalApprovalAddress, 
        totalApproval,
        { 
          nonce: nonce,
          gasLimit: 100000
        }
      );
      console.log("Approval for additional contract sent, waiting for confirmation...");
      await approveTx2.wait();
      console.log("Additional contract approval confirmed");

      // Wait and get fresh nonce
      await new Promise(resolve => setTimeout(resolve, 2000));
      nonce = await wallet.getTransactionCount("latest");
      console.log("Updated nonce for place order:", nonce);

      // Second transaction: Place Order
      const tx = await marketplaceContract.placeOrder(
        testProductId,
        testQuantity,
        testFarmerAddress,
        { 
          gasLimit: 500000,
          nonce: nonce
        }
      );
      console.log("Order transaction sent, waiting for confirmation...");
      await tx.wait();
      console.log("Order confirmed");

      setSuccess('Order placed successfully in auto test!');
    } catch (err) {
      console.error('Auto test error:', err);
      if (err.transaction) {
        console.error('Transaction details:', {
          nonce: err.transaction.nonce,
          from: err.transaction.from,
          to: err.transaction.to,
          data: err.transaction.data
        });
      }
      setError(err.message || 'Auto test error');
    } finally {
      setLoading(false);
    }
  };

  // Add new testing function for product creation and price check
  const handleCreateAndCheckProduct = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const farmerPrivateKey = "5f0f812e5ae3f7301c1f21de3b6281f50e5ef51188c6659c0eb2b0c26157fb92";
      const wallet = new ethers.Wallet(farmerPrivateKey, provider);
      
      const farmerContract = new ethers.Contract(
        farmerContractAddress,
        Farmer.abi,
        wallet
      );

      console.log("Starting product creation process...");
      console.log("Farmer wallet address:", wallet.address);

      // First register farmer if not already registered
      try {
        const isRegistered = await farmerContract.hasProfile();
        console.log("Is farmer registered:", isRegistered);
        
        if (!isRegistered) {
          console.log("Registering farmer profile...");
          const registerTx = await farmerContract.register(
            "Test Farmer",
            "Test Address",
            { gasLimit: 500000 }
          );
          await registerTx.wait();
          console.log("Farmer profile registered");
        } else {
          console.log("Farmer already registered");
        }
      } catch (err) {
        console.log("Error checking/registering farmer:", err.message);
      }

      // Then create catalogue item
      console.log("Creating catalogue item...");
      const catalogueTx = await farmerContract.registerCatalogue(
        "Test Product",
        100,
        "QmTest",
        { gasLimit: 500000 }
      );
      const catalogueReceipt = await catalogueTx.wait();
      console.log("Catalogue item created, tx hash:", catalogueReceipt.transactionHash);

      // Create harvest without depending on catalogue count
      console.log("Creating harvest...");
      const priceInWei = ethers.utils.parseUnits("10", 18);
      console.log("Price in wei:", priceInWei.toString());
      
      const createHarvestTx = await farmerContract.registerHarvest(
        "QmTest",
        Math.floor(Date.now() / 1000),
        0, // Use index 0 since we just created the first catalogue item
        1000,
        1000,
        1000,
        100,
        5,
        priceInWei,
        Math.floor(Date.now() / 1000) + 2592000,
        { gasLimit: 500000 }
      );
      
      console.log("Waiting for harvest transaction...");
      const harvestReceipt = await createHarvestTx.wait();
      console.log("Harvest created, tx hash:", harvestReceipt.transactionHash);

      // Try to get harvest data
      try {
        const harvestData = await farmerContract.getHarvestData(0);
        const pricePerKGFormatted = ethers.utils.formatUnits(harvestData.pricePerKG.toString(), 18);
        console.log("Harvest details:", {
          pricePerKG: pricePerKGFormatted,
          quantity: harvestData.quantity.toString(),
          minOrderQty: harvestData.minOrderQty.toString(),
          farmerAddress: harvestData.farmerAddress
        });

        setSuccess(`Harvest created successfully! Price per KG: ${pricePerKGFormatted} JOD`);
      } catch (err) {
        console.error("Error getting harvest data:", err);
        setError("Harvest created but couldn't fetch details");
      }

    } catch (err) {
      console.error('Test error:', err);
      setError(err.message || 'Test error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Test Order Component</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <div>
        <input
          type="number"
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
      </div>
      <div>
        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div>
        <input
          type="text"
          placeholder="Farmer Address"
          value={farmerAddress}
          onChange={(e) => setFarmerAddress(e.target.value)}
        />
      </div>
      <button onClick={handlePlaceOrder} disabled={loading}>
        {loading ? "Placing Order..." : "Place Order"}
      </button>
      {/* New button for auto testing */}
      <button onClick={handleAutoTest} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? "Testing Order..." : "Test Auto Place Order"}
      </button>
      <button 
        onClick={handleCreateAndCheckProduct} 
        disabled={loading} 
        style={{ marginLeft: '10px' }}
      >
        Test Create Product
      </button>
    </div>
  );
}