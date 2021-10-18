const BigNumber = require('bignumber.js')
const { UI_DATA_FILES } = require('../src/lib/constants')
const { getUIData } = require('../src/lib/data')
const keys = require('../dev-keys.json')
const { getNativeBalances, getPoolBalances, getUsdValue, getRariBalance, getTokenBalance, getUSDEUR } = require('./utils')
const initDb = require('../src/lib/db')
const { cliPreload } = require('../src/runtime/pollers')

const main = async () => {
  await initDb()
  await cliPreload()
  const tokens = await getUIData(UI_DATA_FILES.TOKENS)
  const pools = await getUIData(UI_DATA_FILES.POOLS)
  const accounts = keys.walletAddresses
  // const accounts = ["0x814055779F8d2F591277b76C724b7AdC74fb82D9"]
  console.log("Accounts:", accounts)
  const ethPrice = await getUsdValue(['WETH'], [1])
  const farmPrice = await getUsdValue(['FARM'], [1])
  const iFarmPrice = await getUsdValue(['IFARM'], [1])
  console.log("ETH price:       ", ethPrice, "usd")
  console.log("FARM price:      ", farmPrice, "usd")
  console.log("iFARM price:     ", iFarmPrice, "usd")

  let allStaked = 0, allRewards = 0
  const usdEUR = await getUSDEUR()
  for (const i in accounts) {
    let account = accounts[i]
    console.log("---------------------------------------------")
    console.log("Account:", account)
    console.log("")
    console.log("Fetching native token balances...")
    const nativeBalances = await getNativeBalances(account)

    console.log("Total native balance:", nativeBalances, "usd")
    console.log("")
    allStaked += nativeBalances

    console.log("Fetching pools...")
    let totalUnderlying = 0, totalRewards = 0
    for (const j in pools) {
      const pool = pools[j]
      const result = await getPoolBalances(account, pool)
      if (result.balance[0]>0 || result.rewardTokens[0]) {
        console.log("Pool", j, "of", pools.length, ":", pool.id)
        underlyingValue = await getUsdValue(result.underlying, result.balance)
        console.log("Underlying value:  ", underlyingValue, "usd")
        rewardValue = await getUsdValue(result.rewardTokens, result.rewardAmounts)
        console.log("Reward value:      ", rewardValue, "usd")
        totalUnderlying += underlyingValue
        totalRewards += rewardValue
      }
    }
    console.log("")
    console.log("Total staked:      ", totalUnderlying, "usd")
    console.log("Total rewards:     ", totalRewards, "usd")
    console.log("")
    allStaked += totalUnderlying
    allRewards += totalRewards

    console.log("Fetching Rari positions...")
    let rariBalance = await getRariBalance(account)
    console.log("Rari supplied:    ", rariBalance.supplied, "usd")
    console.log("Rari borrowed:    ", rariBalance.borrowed, "usd")
    console.log("Rari balance:     ", rariBalance.supplied - rariBalance.borrowed, "usd")
    console.log("")
    allStaked += rariBalance.supplied - rariBalance.borrowed

    console.log("Fetching balances...")
    let l = 0
    let totalBalance = 0
    for (const k in tokens) {
      const token = tokens[k]
      const result = await getTokenBalance(account, token)
      if (result > 0) {
        console.log("Token", l, "of", Object.keys(tokens).length, ":", k)
        console.log("USD value:         ", result, "usd")
        totalBalance += result
      }
      l++
    }
    console.log("")
    console.log("Total token balance:", totalBalance, "usd")
    console.log("")
    allStaked += totalBalance

    console.log(".............................................")
    const allBalance = nativeBalances+totalUnderlying+totalRewards+rariBalance.supplied-rariBalance.borrowed+totalBalance
    console.log("Account balance:     ", allBalance, "usd")
    console.log("Account balance:     ", allBalance/usdEUR, "eur")
  }
  console.log("---------------------------------------------")
  console.log("Cumulative balance:   ", allStaked, "usd")
  console.log("Claimable rewards:    ", allRewards, "usd")
  console.log("Grand total:          ", allStaked + allRewards, "usd")
  console.log("Grand total:          ", (allStaked + allRewards)/usdEUR, "eur")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
