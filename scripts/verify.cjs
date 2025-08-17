const { run } = require("hardhat");

async function main() {
  const contractAddress = "0x79C495b3F99EeC74ef06C79677Aee352F40F1De5";
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const ownerAddress = "0x462752537CcE212d278DBD361DA67e25C2908938";

  console.log("Verifying LoveallPrizePool contract on BaseScan...");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`USDC Address: ${usdcAddress}`);
  console.log(`Owner Address: ${ownerAddress}`);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [usdcAddress, ownerAddress],
      contract: "contracts/LoveallPrizePool.sol:LoveallPrizePool",
    });

    console.log("✅ Contract verified successfully on BaseScan!");
    console.log(`🔗 View contract: https://basescan.org/address/${contractAddress}`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified on BaseScan!");
      console.log(`🔗 View contract: https://basescan.org/address/${contractAddress}`);
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
