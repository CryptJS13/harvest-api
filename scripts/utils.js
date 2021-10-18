const BigNumber = require('bignumber.js')
const {
  pool: regularPoolContract,
  potPool: potPoolContract,
  token: tokenContract,
  rariComptroller: comptrollerContract,
  lendingToken: lendingTokenContract,
} = require('../src/lib/web3/contracts')
const { getWeb3 } = require('../src/lib/web3')
const { getTokenPrice } = require('../src/prices')
const { getTokenPriceById } = require('../src/prices/coingecko.js')
const { CHAIN_TYPES } = require('../src/lib/constants.js')

async function getNativeBalances(account) {
  let totalUsd = 0
  for (const i in CHAIN_TYPES) {
    const chain = CHAIN_TYPES[i]
    const provider = getWeb3(chain)
    const balance = new BigNumber(await provider.eth.getBalance(account)).div(1e18)
    let price
    if (chain == '1') {
      price = await getTokenPrice('WETH')
    } else if (chain == '56') {
      price = await getTokenPrice('WBNB')
    } else if (chain == '137') {
      price = await getTokenPrice('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', chain)
    }
    const value = balance.times(price)
    if (value > 0) {
      console.log("USD value on", i, ":", value.toNumber(), "usd")
      totalUsd += value.toNumber()
    }
  }
  return totalUsd
}

async function getPoolBalances(account, pool) {
  const web3Instance = getWeb3(pool.chain)
  const isSingleRewardPool = pool.rewardTokens.length === 1

  const poolContract = isSingleRewardPool ? regularPoolContract : potPoolContract
  const poolInstance = new web3Instance.eth.Contract(
    poolContract.contract.abi,
    pool.contractAddress,
  )
  let balance, tokens = [], amounts = []
  let { methods: {getDecimals}} = tokenContract
  if (isSingleRewardPool) {
    const { methods: {balanceOf, rewardToken, earned}} = poolContract
    const collateralInstance = new web3Instance.eth.Contract(tokenContract.contract.abi, pool.collateralAddress)
    const decimals = await getDecimals(collateralInstance)
    balance = new BigNumber(await balanceOf(account, poolInstance)).div(10**decimals).toFixed()
    if (balance == 0) {
      return {underlying: [pool.collateralAddress], balance: [0], rewardTokens: [], rewardAmounts: []}
    }
    const rewardAddress = await rewardToken(poolInstance)
    const rewardInstance = new web3Instance.eth.Contract(tokenContract.contract.abi, rewardAddress)
    const rewardDecimals = await getDecimals(rewardInstance)
    const rewardBalance = new BigNumber(await earned(account, poolInstance)).div(10**rewardDecimals).toFixed()
    if (rewardBalance > 0) {
      tokens.push(rewardAddress)
      amounts.push(rewardBalance)
    }
  } else {
    const { methods: {balanceOf, rewardTokens, rewardTokensLength, earnedByAddress, earnedByIndex} } = poolContract
    const decimals = await getDecimals(poolInstance)
    balance = new BigNumber(await balanceOf(account, poolInstance)).div(10**decimals).toFixed()
    if (balance == 0) {
      return {underlying: [pool.collateralAddress], balance: [0], rewardTokens: [], rewardAmounts: []}
    }
    for (let i = 0; i < await rewardTokensLength(poolInstance); i++) {
      rewardAddress = await rewardTokens(i, poolInstance)
      const rewardInstance = new web3Instance.eth.Contract(tokenContract.contract.abi, rewardAddress)
      const rewardDecimals = await getDecimals(rewardInstance)
      const rewardBalance = new BigNumber(await earnedByIndex(i, account, poolInstance)).div(10**rewardDecimals).toFixed()
      if (rewardBalance > 0) {
        tokens.push(rewardAddress)
        amounts.push(rewardBalance)
      }
    }
  }
  return {underlying: [pool.collateralAddress], balance: [balance], rewardTokens: tokens, rewardAmounts: amounts}
}

async function getUsdValue(tokens, amounts) {
  let value = 0
  for (let i = 0; i < tokens.length; i++) {
    let price = await getTokenPrice(tokens[i])
    let tokenValue = price * amounts[i]
    value = value + tokenValue
  }
  return value
}

async function getRariBalance(account) {
  const web3Instance = getWeb3("1")
  const comptrollerInstance = new web3Instance.eth.Contract(
    comptrollerContract.contract.abi,
    comptrollerContract.contract.address.mainnet,
  )
  const { methods: {getAssetsIn}} = comptrollerContract
  const assets = await getAssetsIn(account, comptrollerInstance)
  let totalSupplied = 0, totalBorrowed = 0
  for (let i=0;i<assets.length;i++) {
    const assetInstance = new web3Instance.eth.Contract( lendingTokenContract.contract.abi, assets[i] )
    const { methods: {getBalance, getExchangeRate, getBorrowBalance, getUnderlying}} = lendingTokenContract
    const balance = new BigNumber(await getBalance(account, assetInstance)).div(1e8)

    let underlying = await getUnderlying(assetInstance)
    if (underlying == "0x0000000000000000000000000000000000000000"){
      underlying = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    }
    const underlyingInstance = new web3Instance.eth.Contract(tokenContract.contract.abi, underlying)
    let { methods: {getDecimals}} = tokenContract
    const underlyingDecimals = new BigNumber(await getDecimals(underlyingInstance))
    const exchangeRate = new BigNumber(await getExchangeRate(assetInstance)).div(10**(underlyingDecimals.plus(10)))

    const supplyBalance = balance.times(exchangeRate)
    const borrowBalance = new BigNumber(await getBorrowBalance(account, assetInstance)).div(10**underlyingDecimals)

    const underlyingPrice = await getTokenPrice(underlying)
    const usdSupplied = supplyBalance.times(underlyingPrice)
    const usdBorrowed = borrowBalance.times(underlyingPrice)

    totalSupplied += usdSupplied.toNumber()
    totalBorrowed += usdBorrowed.toNumber()
  }
  return { supplied: totalSupplied, borrowed: totalBorrowed}
}

async function getTokenBalance(account, token) {
  const web3Instance = getWeb3(token.chain)
  const address = token.tokenAddress
  if (address.length < 42) {
    return 0
  }
  const tokenInstance = new web3Instance.eth.Contract(tokenContract.contract.abi, address)
  let { methods: {getDecimals, getBalance}} = tokenContract
  const decimals = await getDecimals(tokenInstance)
  const balance = new BigNumber(await getBalance(account, tokenInstance)).div(10**decimals)
  if (balance == 0) {
    return 0
  }
  const price = await getTokenPrice(address)
  const balanceUsd = balance.times(price)
  return balanceUsd.toNumber()
}

async function getUSDEUR() {
  const ethUSD = new BigNumber(await getTokenPriceById('WETH', 'usd'))
  const ethEUR = new BigNumber(await getTokenPriceById('WETH', 'eur'))
  return ethUSD.div(ethEUR).toNumber()
}

module.exports = {
  getNativeBalances,
  getPoolBalances,
  getUsdValue,
  getRariBalance,
  getTokenBalance,
  getUSDEUR,
}
