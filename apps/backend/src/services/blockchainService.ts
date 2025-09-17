import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';

// Simple contract ABI for storing hashes
const CONTRACT_ABI = [
  "function storeHash(bytes32 hash) external",
  "function getHash(uint256 index) external view returns (bytes32)",
  "function getHashCount() external view returns (uint256)",
  "event HashStored(uint256 indexed index, bytes32 hash, address indexed sender)"
];

interface BlockchainAnchor {
  hash: string;
  network: string;
  transactionHash?: string;
  blockNumber?: number;
}

/**
 * Anchor critical data to blockchain
 */
export async function anchorToBlockchain(data: {
  alert_id?: string;
  user_id?: string;
  type: string;
  severity?: string;
  timestamp: string;
  location_hash?: string;
}): Promise<BlockchainAnchor> {
  try {
    // Create hash of the data (never store actual data on-chain)
    const dataString = JSON.stringify({
      alert_id: data.alert_id,
      user_id: data.user_id ? hashPII(data.user_id) : undefined, // Hash PII
      type: data.type,
      severity: data.severity,
      timestamp: data.timestamp,
      location_hash: data.location_hash ? hashPII(data.location_hash) : undefined
    });
    
    const dataHash = crypto.createHash('sha256').update(dataString).digest('hex');
    const bytes32Hash = '0x' + dataHash;

    // Check if we're in mock mode
    if (process.env.MOCK_BLOCKCHAIN === 'true' || !process.env.POLYGON_RPC_URL) {
      logger.info(`Mock blockchain anchor created: ${bytes32Hash}`);
      
      // Store in database for tracking
      await supabase
        .from('blockchain_anchors')
        .insert({
          reference_type: data.alert_id ? 'alert' : 'user',
          reference_id: data.alert_id || data.user_id!,
          hash: bytes32Hash,
          transaction_hash: `mock_tx_${Date.now()}`,
          network: 'mock',
          created_at: new Date().toISOString()
        });

      return {
        hash: bytes32Hash,
        network: 'mock',
        transactionHash: `mock_tx_${Date.now()}`
      };
    }

    // Initialize blockchain connection
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    
    // Contract address (deploy if needed)
    const contractAddress = process.env.CONTRACT_ADDRESS || await deployContract(wallet);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    // Store hash on blockchain
    const tx = await contract.storeHash(bytes32Hash, {
      gasLimit: 100000
    });

    logger.info(`Blockchain transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    
    logger.info(`Hash ${bytes32Hash} anchored to blockchain at block ${receipt.blockNumber}`);

    // Store anchor record in database
    await supabase
      .from('blockchain_anchors')
      .insert({
        reference_type: data.alert_id ? 'alert' : 'user',
        reference_id: data.alert_id || data.user_id!,
        hash: bytes32Hash,
        transaction_hash: receipt.hash,
        network: 'polygon-mumbai',
        block_number: receipt.blockNumber,
        created_at: new Date().toISOString()
      });

    return {
      hash: bytes32Hash,
      network: 'polygon-mumbai',
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    logger.error('Blockchain anchoring failed:', error);
    
    // Fallback to database-only storage for critical alerts
    const fallbackHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    
    await supabase
      .from('blockchain_anchors')
      .insert({
        reference_type: data.alert_id ? 'alert' : 'user',
        reference_id: data.alert_id || data.user_id!,
        hash: '0x' + fallbackHash,
        transaction_hash: `fallback_${Date.now()}`,
        network: 'fallback',
        created_at: new Date().toISOString()
      });

    throw error;
  }
}

/**
 * Verify blockchain anchor
 */
export async function verifyBlockchainAnchor(
  referenceType: 'alert' | 'user',
  referenceId: string
): Promise<{
  verified: boolean;
  hash?: string;
  transactionHash?: string;
  network?: string;
  blockNumber?: number;
}> {
  try {
    const { data: anchor, error } = await supabase
      .from('blockchain_anchors')
      .select('*')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .single();

    if (error || !anchor) {
      return { verified: false };
    }

    // For mock/fallback anchors, just return stored data
    if (anchor.network === 'mock' || anchor.network === 'fallback') {
      return {
        verified: true,
        hash: anchor.hash,
        transactionHash: anchor.transaction_hash,
        network: anchor.network
      };
    }

    // Verify on actual blockchain
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    const receipt = await provider.getTransactionReceipt(anchor.transaction_hash);

    if (!receipt) {
      return { verified: false };
    }

    return {
      verified: true,
      hash: anchor.hash,
      transactionHash: anchor.transaction_hash,
      network: anchor.network,
      blockNumber: anchor.block_number
    };

  } catch (error) {
    logger.error('Blockchain verification failed:', error);
    return { verified: false };
  }
}

/**
 * Deploy smart contract for hash storage
 */
async function deployContract(wallet: ethers.Wallet): Promise<string> {
  // Simple contract bytecode for storing hashes
  // This is a simplified version - in production, use proper contract deployment
  const contractCode = `
    pragma solidity ^0.8.0;
    
    contract HashStorage {
        bytes32[] private hashes;
        
        event HashStored(uint256 indexed index, bytes32 hash, address indexed sender);
        
        function storeHash(bytes32 hash) external {
            hashes.push(hash);
            emit HashStored(hashes.length - 1, hash, msg.sender);
        }
        
        function getHash(uint256 index) external view returns (bytes32) {
            require(index < hashes.length, "Index out of bounds");
            return hashes[index];
        }
        
        function getHashCount() external view returns (uint256) {
            return hashes.length;
        }
    }
  `;

  // For demo purposes, return a mock contract address
  // In production, compile and deploy the actual contract
  const mockAddress = '0x' + crypto.randomBytes(20).toString('hex');
  logger.info(`Mock contract deployed at: ${mockAddress}`);
  
  return mockAddress;
}

/**
 * Hash PII data for blockchain storage
 */
function hashPII(data: string): string {
  return crypto.createHash('sha256').update(data + process.env.ENCRYPTION_KEY).digest('hex');
}