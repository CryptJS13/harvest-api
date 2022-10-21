const BigNumber = require('bignumber.js')
const { UI_DATA_FILES } = require('../src/lib/constants')
const { getUIData } = require('../src/lib/data')
const keys = require('../dev-keys.json')
const {
  getNativeBalances,
  getPoolBalances,
  getEurValue,
  getTokenBalance,
  getUSDEUR,
  isETH,
  isBTC,
  isSTABLE,
  isFARM,
} = require('./utils')
const initDb = require('../src/lib/db')
const { cliPreload } = require('../src/runtime/pollers')

const main = async () => {
  await initDb()
  await cliPreload()
  const tokens = await getUIData(UI_DATA_FILES.TOKENS)
  const pools = await getUIData(UI_DATA_FILES.POOLS)
  const accounts = keys.walletAddresses
  console.log('Accounts:', accounts)
  const usdEUR = await getUSDEUR()
  console.log('usdEur:          ', usdEUR)
  const ethPrice = await getEurValue(['WETH'], [1], 1, usdEUR)
  const farmPrice = await getEurValue(['FARM'], [1], 1, usdEUR)
  const iFarmPrice = await getEurValue(['IFARM'], [1], 1, usdEUR)
  console.log('ETH price:       ', ethPrice, 'eur')
  console.log('FARM price:      ', farmPrice, 'eur')
  console.log('iFARM price:     ', iFarmPrice, 'eur')

  let allStaked = 0,
    allRewards = 0,
    cryptoBalance = 0,
    stableBalance = 0,
    ethBalance = 0,
    btcBalance = 0,
    farmBalance = 0
  for (const i in accounts) {
    let account = accounts[i]
    console.log('---------------------------------------------')
    console.log('Account:', account)
    console.log('')
    console.log('Fetching native token balances...')
    const nativeBalances = await getNativeBalances(account, usdEUR)

    console.log('Total native balance:', nativeBalances, 'eur')
    console.log('')
    allStaked += nativeBalances
    cryptoBalance += nativeBalances

    console.log('Fetching pools...')
    let totalUnderlying = 0,
      totalRewards = 0
    for (const j in pools) {
      const pool = pools[j]
      const result = await getPoolBalances(account, pool)
      if (result.balance[0] > 0 || result.rewardTokens[0]) {
        console.log('Pool', j, 'of', pools.length, ':', pool.id)
        underlyingValue = await getEurValue(result.underlying, result.balance, pool.chain, usdEUR)
        console.log('Underlying value:  ', underlyingValue, 'eur')
        rewardValue = await getEurValue(
          result.rewardTokens,
          result.rewardAmounts,
          pool.chain,
          usdEUR,
        )
        console.log('Reward value:      ', rewardValue, 'eur')
        totalUnderlying += underlyingValue
        totalRewards += rewardValue
        cryptoBalance += rewardValue
        if (isSTABLE(pool.contractAddress)) {
          stableBalance += underlyingValue
        } else if (isETH(pool.contractAddress)) {
          ethBalance += underlyingValue
        } else if (isBTC(pool.contractAddress)) {
          btcBalance += underlyingValue
        } else if (isFARM(pool.contractAddress)) {
          farmBalance += underlyingValue
        } else {
          cryptoBalance += underlyingValue
        }
      }
    }
    console.log('')
    console.log('Total staked:      ', totalUnderlying, 'eur')
    console.log('Total rewards:     ', totalRewards, 'eur')
    console.log('')
    allStaked += totalUnderlying
    allRewards += totalRewards

    console.log('Fetching balances...')
    let l = 0
    let totalBalance = 0
    for (const k in tokens) {
      const token = tokens[k]
      const result = await getTokenBalance(account, token, usdEUR)
      if (result > 0.01) {
        console.log('Token', l, 'of', Object.keys(tokens).length, ':', k)
        console.log('EUR value:         ', result, 'eur')
        totalBalance += result
        if (isSTABLE(token.tokenAddress)) {
          stableBalance += result
        } else if (isETH(token.tokenAddress)) {
          ethBalance += result
        } else if (isBTC(token.tokenAddress)) {
          btcBalance += result
        } else if (isFARM(token.tokenAddress)) {
          farmBalance += result
        } else {
          cryptoBalance += result
        }
      }
      l++
    }
    console.log('')
    console.log('Total token balance:', totalBalance, 'eur')
    console.log('')
    allStaked += totalBalance

    console.log('.............................................')
    const allBalance = nativeBalances + totalUnderlying + totalRewards + totalBalance
    console.log('Account balance:     ', allBalance, 'eur')
  }
  console.log('---------------------------------------------')
  console.log('Cumulative balance:   ', allStaked, 'eur')
  console.log('Claimable rewards:    ', allRewards, 'eur')
  console.log('Grand total:          ', allStaked + allRewards, 'eur')
  console.log('---------------------------------------------')
  console.log('FARM value:           ', farmBalance, 'eur')
  console.log('STABLE value:         ', stableBalance, 'eur')
  console.log('ETH value:            ', ethBalance, 'eur')
  console.log('BTC value:            ', btcBalance, 'eur')
  console.log('Other crypto value:   ', cryptoBalance, 'eur')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
