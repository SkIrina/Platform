# ACDMPlatform
 
ACDMToken deployed to: 0x14F0E23Dbd23134A779cCbF60a55c211E2197dF5

XXXToken deployed to: 0x079C42C7733caddf1913FA326819915945Bc0f94;

Staking deployed to: 0x2c1DeEA6DD8a218CfB8bBa511FFc828619B825b2

aCDMPlatform deployed to: 0x9fc66FA4A38C7c608f9295AD7ba4A8213777A6F0

Dao deployed to: 0x96Ce1577B5138f40f23cF31195D78424a9Cd3687


ACDMToken (ERC20Burnable) decimals = 6

XXXToken (ERC20Burnable) decimals = 18

XXXToken\Weth listed on uniswap


Staking: stake LP from this pair - receive XXXToken


Dao: deposit is the stake in Staking. Dao regulates lockedTime, rewardRate in Staking
and referrers's rates, feeSum usage in ACDMPlatform.


ACDMPlatform: at Sale round - buy ACDMTokens from platform, at Trade round - trade these tokens,
amount of new tokens for the next Sale round is determined by trade volume in Trade round.
Price at Sale round rises each round. Referrers program, fees go to referrers when buying token from platform or trades.


### Testing notes

Dependencies:

staking.ts: Staking contract - tokens

dao.ts: Dao contract -  Staking, tokens (Staking functions onlyDao checked here)

index.ts: ACDMPlatform - Dao, Staking, tokens

Tests run on Rinkeby fork.
