import 'dotenv/config';
import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');

// RPC configuration
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    process.exit(1);
}

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// Character presets
const CHARACTER_PRESETS = {
    'jordan-belfort': {
        name: 'Jordan Belfort',
        task: 'Channel the Wolf of Wall Street\'s confidence and charm to create irresistible flirty responses that close the deal on romance',
        traitNames: ['Persuasiveness', 'Charisma', 'Confidence', 'Wit', 'Boldness'],
        traitValues: [9, 10, 8, 7, 9],
        traitCount: 5
    },
    'casanova': {
        name: 'Giacomo Casanova',
        task: 'Embody the legendary lover\'s sophisticated charm and romantic eloquence to craft enchanting flirtatious messages',
        traitNames: ['Romance', 'Sophistication', 'Charm', 'Poetry', 'Seduction'],
        traitValues: [10, 9, 10, 8, 9],
        traitCount: 5
    },
    'ryan-gosling': {
        name: 'Ryan Gosling',
        task: 'Channel Ryan Gosling\'s mysterious cool and understated charm to create subtly magnetic flirty responses',
        traitNames: ['Mystique', 'Cool', 'Authenticity', 'Charm', 'Subtlety'],
        traitValues: [9, 10, 8, 8, 9],
        traitCount: 5
    },
    'barney-stinson': {
        name: 'Barney Stinson',
        task: 'Bring Barney\'s legendary confidence and catchphrases to create fun, bold, and unforgettable flirty responses',
        traitNames: ['Confidence', 'Humor', 'Boldness', 'Energy', 'Catchiness'],
        traitValues: [10, 9, 10, 10, 9],
        traitCount: 5
    },
    'james-bond': {
        name: 'James Bond',
        task: 'Embody 007\'s suave sophistication and dangerous charm to craft irresistibly smooth flirty messages',
        traitNames: ['Sophistication', 'Charm', 'Danger', 'Wit', 'Class'],
        traitValues: [10, 9, 8, 9, 10],
        traitCount: 5
    }
};

async function getCurrentCharacter() {
    try {
        console.log('📋 Getting current character...');
        const [name, task, traitNames, traitValues, traitCount, isSet] = await contract.getCurrentCharacter();
        
        if (!isSet) {
            console.log('❌ No character set for current week');
            return;
        }

        console.log('\n🎭 Current Character:');
        console.log(`Name: ${name}`);
        console.log(`Task: ${task}`);
        console.log(`Trait Count: ${traitCount}`);
        console.log('\nTraits:');
        for (let i = 0; i < traitCount; i++) {
            console.log(`  ${traitNames[i]}: ${traitValues[i]}/10`);
        }
    } catch (error) {
        console.error('❌ Error getting current character:', error.message);
    }
}

async function setCharacter(characterKey, customCharacter = null) {
    try {
        let character;
        
        if (customCharacter) {
            character = customCharacter;
        } else if (CHARACTER_PRESETS[characterKey]) {
            character = CHARACTER_PRESETS[characterKey];
        } else {
            console.error('❌ Unknown character preset. Available presets:', Object.keys(CHARACTER_PRESETS).join(', '));
            return;
        }

        console.log(`🎭 Setting character: ${character.name}`);
        console.log(`Task: ${character.task}`);

        // Validate trait count
        if (character.traitCount < 1 || character.traitCount > 5) {
            console.error('❌ Trait count must be between 1 and 5');
            return;
        }

        // Validate trait values
        for (let i = 0; i < character.traitCount; i++) {
            if (character.traitValues[i] < 1 || character.traitValues[i] > 10) {
                console.error(`❌ Trait value ${i + 1} must be between 1 and 10`);
                return;
            }
        }

        // Estimate gas
        const gasEstimate = await contract.setWeeklyCharacter.estimateGas(
            character.name,
            character.task,
            character.traitNames,
            character.traitValues,
            character.traitCount
        );

        console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

        // Send transaction
        const tx = await contract.setWeeklyCharacter(
            character.name,
            character.task,
            character.traitNames,
            character.traitValues,
            character.traitCount,
            { gasLimit: gasEstimate.mul(120).div(100) } // Add 20% buffer
        );

        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');

        const receipt = await tx.wait();
        console.log(`✅ Character set successfully! Block: ${receipt.blockNumber}`);
        
        // Show the set character
        await getCurrentCharacter();

    } catch (error) {
        console.error('❌ Error setting character:', error.message);
        
        if (error.message.includes('CharacterAlreadySet')) {
            console.log('💡 Character is already set for this week. Wait for next week to change.');
        }
    }
}

async function listPresets() {
    console.log('🎭 Available Character Presets:\n');
    
    Object.entries(CHARACTER_PRESETS).forEach(([key, character]) => {
        console.log(`${key}:`);
        console.log(`  Name: ${character.name}`);
        console.log(`  Task: ${character.task.substring(0, 80)}${character.task.length > 80 ? '...' : ''}`);
        console.log(`  Traits: ${character.traitNames.slice(0, character.traitCount).join(', ')}`);
        console.log('');
    });
}

async function getWeeklyCharacter(week) {
    try {
        console.log(`📋 Getting character for week ${week}...`);
        const [name, task, traitNames, traitValues, traitCount, isSet] = await contract.getWeeklyCharacter(week);
        
        if (!isSet) {
            console.log(`❌ No character set for week ${week}`);
            return;
        }

        console.log(`\n🎭 Week ${week} Character:`);
        console.log(`Name: ${name}`);
        console.log(`Task: ${task}`);
        console.log(`Trait Count: ${traitCount}`);
        console.log('\nTraits:');
        for (let i = 0; i < traitCount; i++) {
            console.log(`  ${traitNames[i]}: ${traitValues[i]}/10`);
        }
    } catch (error) {
        console.error('❌ Error getting weekly character:', error.message);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🎭 Character Management Script

Usage:
  node manage-character.js current                    # Get current character
  node manage-character.js list                       # List available presets
  node manage-character.js set <preset-key>           # Set character from preset
  node manage-character.js week <week-number>         # Get character for specific week

Available presets: ${Object.keys(CHARACTER_PRESETS).join(', ')}

Examples:
  node manage-character.js set jordan-belfort
  node manage-character.js set casanova
  node manage-character.js week 5
        `);
        return;
    }

    const command = args[0];

    switch (command) {
        case 'current':
            await getCurrentCharacter();
            break;
            
        case 'list':
            await listPresets();
            break;
            
        case 'set':
            if (args.length < 2) {
                console.error('❌ Please specify a character preset');
                await listPresets();
                return;
            }
            await setCharacter(args[1]);
            break;
            
        case 'week':
            if (args.length < 2) {
                console.error('❌ Please specify a week number');
                return;
            }
            const week = parseInt(args[1]);
            if (isNaN(week)) {
                console.error('❌ Week must be a number');
                return;
            }
            await getWeeklyCharacter(week);
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
