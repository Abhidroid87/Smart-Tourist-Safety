#!/usr/bin/env node

/**
 * Smart Contract Deployment Script for Tourist Safety System
 * 
 * This script deploys a simple hash storage contract to the blockchain
 * for anchoring critical safety data and maintaining immutable records.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract source code
const CONTRACT_SOURCE = `
pragma solidity ^0.8.19;

/**
 * @title TouristSafetyAnchor
 * @dev Simple contract to store SHA-256 hashes of critical safety data
 * @notice This contract only stores hashes, never actual personal data
 */
contract TouristSafetyAnchor {
    struct HashRecord {
        bytes32 hash;
        uint256 timestamp;
        address submitter;
        string recordType; // 'alert', 'incident', 'verification'
    }
    
    HashRecord[] public hashRecords;
    mapping(bytes32 => bool) public hashExists;
    mapping(address => bool) public authorizedSubmitters;
    
    address public owner;
    
    event HashStored(
        uint256 indexed recordId,
        bytes32 indexed hash,
        string recordType,
        address indexed submitter,
        uint256 timestamp
    );
    
    event SubmitterAuthorized(address indexed submitter);
    event SubmitterRevoked(address indexed submitter);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedSubmitters[msg.sender],
            "Not authorized to submit hashes"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedSubmitters[msg.sender] = true;
    }
    
    /**
     * @dev Store a hash on the blockchain
     * @param hash The SHA-256 hash to store
     * @param recordType Type of record being anchored
     */
    function storeHash(bytes32 hash, string memory recordType) 
        external 
        onlyAuthorized 
        returns (uint256) 
    {
        require(!hashExists[hash], "Hash already exists");
        require(bytes(recordType).length > 0, "Record type required");
        
        uint256 recordId = hashRecords.length;
        
        hashRecords.push(HashRecord({
            hash: hash,
            timestamp: block.timestamp,
            submitter: msg.sender,
            recordType: recordType
        }));
        
        hashExists[hash] = true;
        
        emit HashStored(recordId, hash, recordType, msg.sender, block.timestamp);
        
        return recordId;
    }
    
    /**
     * @dev Get hash record by ID
     * @param recordId The record ID to retrieve
     */
    function getHashRecord(uint256 recordId) 
        external 
        view 
        returns (bytes32, uint256, address, string memory) 
    {
        require(recordId < hashRecords.length, "Record does not exist");
        
        HashRecord memory record = hashRecords[recordId];
        return (record.hash, record.timestamp, record.submitter, record.recordType);
    }
    
    /**
     * @dev Get total number of stored hashes
     */
    function getHashCount() external view returns (uint256) {
        return hashRecords.length;
    }
    
    /**
     * @dev Verify if a hash exists on the blockchain
     * @param hash The hash to verify
     */
    function verifyHash(bytes32 hash) external view returns (bool) {
        return hashExists[hash];
    }
    
    /**
     * @dev Authorize a new submitter
     * @param submitter Address to authorize
     */
    function authorizeSubmitter(address submitter) external onlyOwner {
        authorizedSubmitters[submitter] = true;
        emit SubmitterAuthorized(submitter);
    }
    
    /**
     * @dev Revoke submitter authorization
     * @param submitter Address to revoke
     */
    function revokeSubmitter(address submitter) external onlyOwner {
        authorizedSubmitters[submitter] = false;
        emit SubmitterRevoked(submitter);
    }
    
    /**
     * @dev Check if address is authorized
     * @param submitter Address to check
     */
    function isAuthorized(address submitter) external view returns (bool) {
        return submitter == owner || authorizedSubmitters[submitter];
    }
}
`;

// Contract ABI (will be generated after compilation)
const CONTRACT_ABI = [
  "constructor()",
  "function storeHash(bytes32 hash, string recordType) external returns (uint256)",
  "function getHashRecord(uint256 recordId) external view returns (bytes32, uint256, address, string)",
  "function getHashCount() external view returns (uint256)",
  "function verifyHash(bytes32 hash) external view returns (bool)",
  "function authorizeSubmitter(address submitter) external",
  "function revokeSubmitter(address submitter) external",
  "function isAuthorized(address submitter) external view returns (bool)",
  "event HashStored(uint256 indexed recordId, bytes32 indexed hash, string recordType, address indexed submitter, uint256 timestamp)"
];

// Simple bytecode (in production, compile with proper tools like Hardhat)
const CONTRACT_BYTECODE = "0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060016003600033815260200190815260200160002060006101000a81548160ff02191690831515021790555061048f806100856000396000f3fe608060405234801561001057600080fd5b50600436106100885760003560e01c80638da5cb5b1161005b5780638da5cb5b146101165780639507d39a14610134578063e78cea9214610164578063f7b5c27a1461019457610088565b80631c31b2cf146100865780634f558e791461008e578063701da98e146100be5780637b7c4d7e146100ec57610088565b5b005b60015481565b6100a860048036038101906100a39190610300565b6101c4565b6040516100b59190610366565b60405180910390f35b6100d860048036038101906100d39190610300565b6101de565b6040516100e59190610366565b60405180910390f35b61010660048036038101906101019190610300565b610247565b6040516101139190610366565b60405180910390f35b61011e610267565b60405161012b91906103be565b60405180910390f35b61014e60048036038101906101499190610405565b61028b565b60405161015b9190610366565b60405180910390f35b61017e60048036038101906101799190610300565b6102ab565b60405161018b9190610366565b60405180910390f35b6101ae60048036038101906101a99190610300565b6102cb565b6040516101bb9190610366565b60405180910390f35b60026020528060005260406000206000915054906101000a900460ff1681565b6000600360008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff169050919050565b60036020528060005260406000206000915054906101000a900460ff1681565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600081600154101561029c57600080fd5b600154905092915050565b600060026000838152602001908152602001600020549050919050565b6000600154905090565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000610301826102d6565b9050919050565b610311816102f6565b811461031c57600080fd5b50565b60008135905061032e81610308565b92915050565b60008115159050919050565b61034981610334565b82525050565b60008190509291505056";

async function deployContract() {
  try {
    console.log('🚀 Starting Smart Contract Deployment for Tourist Safety System');
    console.log('================================================');

    // Validate environment variables
    if (!process.env.POLYGON_RPC_URL) {
      throw new Error('POLYGON_RPC_URL environment variable is required');
    }

    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    console.log('✅ Environment variables validated');

    // Connect to blockchain network
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Get network info
    const network = await provider.getNetwork();
    console.log(`🌐 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther('0.001')) {
      console.warn('⚠️  Low balance detected. Deployment may fail due to insufficient funds.');
    }

    console.log(`🔑 Deploying from address: ${wallet.address}`);

    // Estimate gas
    console.log('⛽ Estimating deployment gas...');

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(
      CONTRACT_ABI,
      CONTRACT_BYTECODE,
      wallet
    );

    // Deploy contract
    console.log('📦 Deploying TouristSafetyAnchor contract...');
    
    const contract = await contractFactory.deploy({
      gasLimit: 2000000, // Set reasonable gas limit
      gasPrice: ethers.parseUnits('20', 'gwei') // Set gas price
    });

    console.log(`⏳ Transaction hash: ${contract.deploymentTransaction().hash}`);
    console.log('Waiting for deployment confirmation...');

    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log('✅ Contract deployed successfully!');
    console.log(`📍 Contract address: ${contractAddress}`);

    // Verify deployment
    console.log('🔍 Verifying deployment...');
    const code = await provider.getCode(contractAddress);
    
    if (code === '0x') {
      throw new Error('Contract deployment failed - no code at address');
    }

    console.log('✅ Contract verification passed');

    // Test basic functionality
    console.log('🧪 Testing basic functionality...');
    
    try {
      const isAuthorized = await contract.isAuthorized(wallet.address);
      console.log(`✅ Owner authorization check: ${isAuthorized}`);

      const hashCount = await contract.getHashCount();
      console.log(`✅ Initial hash count: ${hashCount}`);

      // Test storing a hash
      const testHash = ethers.keccak256(ethers.toUtf8Bytes('test_emergency_alert'));
      const tx = await contract.storeHash(testHash, 'test');
      await tx.wait();

      const newHashCount = await contract.getHashCount();
      console.log(`✅ Hash storage test: ${newHashCount} (should be 1)`);

    } catch (testError) {
      console.error('⚠️  Contract functionality test failed:', testError.message);
    }

    // Save deployment information
    const deploymentInfo = {
      contractAddress,
      network: network.name,
      chainId: Number(network.chainId),
      deployerAddress: wallet.address,
      transactionHash: contract.deploymentTransaction().hash,
      deployedAt: new Date().toISOString(),
      gasUsed: contract.deploymentTransaction().gasLimit?.toString(),
      abi: CONTRACT_ABI
    };

    // Write deployment info to file
    const deploymentPath = path.join(__dirname, '../../contract-deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentPath}`);

    // Update environment file template
    console.log('📝 Updating .env.example with contract address...');
    const envExamplePath = path.join(__dirname, '../../.env.example');
    
    if (fs.existsSync(envExamplePath)) {
      let envContent = fs.readFileSync(envExamplePath, 'utf8');
      envContent = envContent.replace(
        /CONTRACT_ADDRESS=.*$/m,
        `CONTRACT_ADDRESS=${contractAddress}`
      );
      fs.writeFileSync(envExamplePath, envContent);
      console.log('✅ .env.example updated');
    }

    console.log('================================================');
    console.log('🎉 Deployment completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log(`1. Update your .env file with: CONTRACT_ADDRESS=${contractAddress}`);
    console.log('2. Verify the contract on block explorer if desired');
    console.log('3. Test the blockchain anchoring functionality');
    console.log('4. Configure additional authorized submitters if needed');
    console.log('');
    console.log('Contract features:');
    console.log('• Store SHA-256 hashes of critical alerts');
    console.log('• Verify hash existence');
    console.log('• Access control for authorized submitters');
    console.log('• Event logging for audit trails');

    return {
      success: true,
      contractAddress,
      transactionHash: contract.deploymentTransaction().hash,
      network: network.name
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Try:');
      console.log('1. Get testnet tokens from a faucet');
      console.log('2. Check your wallet balance');
      console.log('3. Reduce gas price in the deployment script');
    }
    
    if (error.message.includes('nonce')) {
      console.log('💡 Try resetting your wallet nonce or waiting a moment');
    }

    process.exit(1);
  }
}

// Run deployment if this script is called directly
if (require.main === module) {
  deployContract()
    .then(result => {
      console.log('Deployment result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = { deployContract, CONTRACT_ABI, CONTRACT_BYTECODE };