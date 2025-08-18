require('dotenv').config();
const { ethers } = require('ethers');

// Network configurations
const NETWORKS = {
    'base-mainnet': {
        name: 'Base Mainnet',
        rpcUrl: 'https://mainnet.base.org',
        chainId: 8453,
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        blockExplorer: 'https://basescan.org'
    },
    'base-sepolia': {
        name: 'Base Sepolia',
        rpcUrl: 'https://sepolia.base.org',
        chainId: 84532,
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        blockExplorer: 'https://sepolia.basescan.org'
    }
};

async function deployContract(networkKey = 'base-mainnet') {
    try {
        const network = NETWORKS[networkKey];
        if (!network) {
            console.error(`❌ Unknown network: ${networkKey}`);
            console.log('Available networks:', Object.keys(NETWORKS).join(', '));
            return;
        }

        console.log(`🚀 Deploying LoveallPrizePool to ${network.name}...`);
        
        // Initialize provider and wallet
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log(`Deployer address: ${wallet.address}`);
        
        // Check balance
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        console.log(`Deployer balance: ${balanceEth} ETH`);
        
        if (parseFloat(balanceEth) < 0.01) {
            console.error('❌ Insufficient ETH balance for deployment');
            return;
        }
        
        // Load contract artifacts
        const contractArtifact = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json');
        
        // Create contract factory
        const contractFactory = new ethers.ContractFactory(
            contractArtifact.abi,
            contractArtifact.bytecode,
            wallet
        );
        
        // Deploy contract
        console.log('📦 Deploying contract...');
        const contract = await contractFactory.deploy(
            network.usdcAddress,  // USDC token address
            wallet.address        // Owner address
        );
        
        console.log(`⏳ Deployment transaction: ${contract.deploymentTransaction().hash}`);
        console.log('Waiting for deployment confirmation...');
        
        // Wait for deployment
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        
        console.log(`✅ Contract deployed successfully!`);
        console.log(`📍 Contract address: ${contractAddress}`);
        console.log(`🔗 Block explorer: ${network.blockExplorer}/address/${contractAddress}`);
        
        // Verify deployment
        console.log('\n🔍 Verifying deployment...');
        const owner = await contract.owner();
        const usdcToken = await contract.usdcToken();
        const castCost = await contract.castCost();
        const currentWeek = await contract.currentWeek();
        
        console.log(`Owner: ${owner}`);
        console.log(`USDC Token: ${usdcToken}`);
        console.log(`Cast Cost: ${ethers.formatUnits(castCost, 6)} USDC`);
        console.log(`Current Week: ${currentWeek}`);
        
        // Save deployment info
        const deploymentInfo = {
            network: network.name,
            chainId: network.chainId,
            contractAddress,
            deployer: wallet.address,
            usdcAddress: network.usdcAddress,
            deploymentBlock: contract.deploymentTransaction().blockNumber,
            deploymentHash: contract.deploymentTransaction().hash,
            timestamp: new Date().toISOString()
        };
        
        const fs = require('fs');
        const deploymentFile = `deployment-${networkKey}-${Date.now()}.json`;
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`📄 Deployment info saved to: ${deploymentFile}`);
        
        return contractAddress;
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        
        if (error.message.includes('insufficient funds')) {
            console.log('💡 Make sure you have enough ETH for gas fees');
        }
    }
}

async function verifyContract(contractAddress, networkKey = 'base-mainnet') {
    try {
        const network = NETWORKS[networkKey];
        console.log(`🔍 Verifying contract on ${network.name}...`);
        
        // This would typically integrate with Hardhat verify plugin
        console.log(`📍 Contract: ${contractAddress}`);
        console.log(`🔗 Explorer: ${network.blockExplorer}/address/${contractAddress}`);
        console.log('');
        console.log('To verify manually on Basescan:');
        console.log('1. Go to the contract page');
        console.log('2. Click "Contract" tab');
        console.log('3. Click "Verify and Publish"');
        console.log('4. Use these settings:');
        console.log('   - Compiler Type: Solidity (Single file)');
        console.log('   - Compiler Version: v0.8.20');
        console.log('   - License: MIT');
        console.log('   - Upload the flattened contract source');
        
    } catch (error) {
        console.error('❌ Verification check failed:', error.message);
    }
}

async function setupContract(contractAddress, networkKey = 'base-mainnet') {
    try {
        const network = NETWORKS[networkKey];
        console.log(`⚙️  Setting up contract on ${network.name}...`);
        
        // Initialize contract
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contractABI = require('../src/abi.json');
        const contract = new ethers.Contract(contractAddress, contractABI, wallet);
        
        console.log('1. Setting initial character...');
        
        // Set initial character (Jordan Belfort)
        const initialCharacter = {
            name: 'Jordan Belfort',
            task: 'Channel the Wolf of Wall Street\'s confidence and charm to create irresistible flirty responses that close the deal on romance',
            traitNames: ['Persuasiveness', 'Charisma', 'Confidence', 'Wit', 'Boldness'],
            traitValues: [9, 10, 8, 7, 9],
            traitCount: 5
        };
        
        const tx1 = await contract.setWeeklyCharacter(
            initialCharacter.name,
            initialCharacter.task,
            initialCharacter.traitNames,
            initialCharacter.traitValues,
            initialCharacter.traitCount
        );
        
        console.log(`⏳ Character transaction: ${tx1.hash}`);
        await tx1.wait();
        console.log('✅ Initial character set');
        
        console.log('\n🎉 Contract setup complete!');
        console.log(`📍 Contract: ${contractAddress}`);
        console.log(`🎭 Character: ${initialCharacter.name}`);
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

async function getContractInfo(contractAddress, networkKey = 'base-mainnet') {
    try {
        const network = NETWORKS[networkKey];
        console.log(`📊 Getting contract info from ${network.name}...`);
        
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const contractABI = require('../src/abi.json');
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        
        // Get common data
        const commonData = await contract.getCommonData();
        const owner = await contract.owner();
        const usdcToken = await contract.usdcToken();
        
        console.log(`\n📋 Contract Information:`);
        console.log(`Address: ${contractAddress}`);
        console.log(`Owner: ${owner}`);
        console.log(`USDC Token: ${usdcToken}`);
        console.log(`Current Week: ${commonData.currentWeek}`);
        console.log(`Cast Cost: ${ethers.formatUnits(commonData.castCost, 6)} USDC`);
        console.log(`Current Prize Pool: ${ethers.formatUnits(commonData.currentWeekPrizePool, 6)} USDC`);
        console.log(`Total Prize Pool: ${ethers.formatUnits(commonData.totalPrizePool, 6)} USDC`);
        console.log(`Participants: ${commonData.currentWeekParticipantsCount}`);
        
        if (commonData.characterIsSet) {
            console.log(`\n🎭 Current Character:`);
            console.log(`Name: ${commonData.characterName}`);
            console.log(`Task: ${commonData.characterTask}`);
        } else {
            console.log('\n❌ No character set');
        }
        
    } catch (error) {
        console.error('❌ Error getting contract info:', error.message);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🚀 LoveallPrizePool Deployment Helper

Usage:
  node deploy-helper.js deploy [network]                    # Deploy new contract
  node deploy-helper.js verify <address> [network]          # Verify contract
  node deploy-helper.js setup <address> [network]           # Setup contract after deployment
  node deploy-helper.js info <address> [network]            # Get contract information

Networks: ${Object.keys(NETWORKS).join(', ')} (default: base-mainnet)

Examples:
  node deploy-helper.js deploy base-mainnet
  node deploy-helper.js setup 0x123... base-mainnet
  node deploy-helper.js info 0x123...
        `);
        return;
    }

    const command = args[0];
    const network = args[2] || 'base-mainnet';

    if (!process.env.PRIVATE_KEY) {
        console.error('❌ PRIVATE_KEY not found in environment variables');
        return;
    }

    switch (command) {
        case 'deploy':
            await deployContract(args[1] || 'base-mainnet');
            break;
            
        case 'verify':
            if (args.length < 2) {
                console.error('❌ Please specify a contract address');
                return;
            }
            await verifyContract(args[1], network);
            break;
            
        case 'setup':
            if (args.length < 2) {
                console.error('❌ Please specify a contract address');
                return;
            }
            await setupContract(args[1], network);
            break;
            
        case 'info':
            if (args.length < 2) {
                console.error('❌ Please specify a contract address');
                return;
            }
            await getContractInfo(args[1], network);
            break;
            
        default:
            console.error(`❌ Unknown command: ${command}`);
            break;
    }
}

// Run the script
main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
});
