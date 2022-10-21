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

const ethTokens = [
  "0x11301B7C82Cd953734440aaF0D5Dd0B36E2aB1d8",
  "0x2E25800957742C52b4d69b65F9C67aBc5ccbffe6",
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  "0xFe2e637202056d30016725477c5da089Ab0A043A",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xc383a3833A87009fD9597F8184979AF5eDFad019"
]
const btcTokens = [
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  "0xEC363faa5c4dd0e51f3D9B5d0101263760E7cdeB"
]
const stableTokens = [
  "0x9c55488f8AdC23544B8571757169AE17865ABFC8",
  "0x2892FA6e9D7Fc9bc8C8e62BBe79AdDff41314d03",
  "0x1046bC2199fa009a19A2a0A04eF598991BA4523E",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
]
const farmTokens = [
  "0x1571eD0bed4D987fe2b498DdBaE7DFA19519F651",
  "0xa0246c9032bC3A600820415aE600c6388619A14D",
  "0xab0b2ddB9C7e440fAc8E140A89c0dbCBf2d7Bbff",
  "0x8cf3F692CAd5Bfa94817Fb425a2871bA11FE883d"
]

function isETH(address) {
  return ethTokens.includes(address)
}

function isBTC(address) {
  return btcTokens.includes(address)
}

function isSTABLE(address) {
  return stableTokens.includes(address)
}

function isFARM(address) {
  return farmTokens.includes(address)
}

async function getNativeBalances(account, usdEUR) {
  let totalEur = 0
  for (const i in CHAIN_TYPES) {
    const chain = CHAIN_TYPES[i]
    const provider = getWeb3(chain)
    const balance = new BigNumber(await provider.eth.getBalance(account)).div(1e18)
    let price
    if (chain == '1') {
      price = await getTokenPrice('WETH')
    } else if (chain == '56') {
      price = await getTokenPrice('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', '56')
    } else if (chain == '137') {
      price = await getTokenPrice('WMATIC')
    }
    const value = balance.times(price).div(usdEUR)
    if (value > 0) {
      console.log("EUR value on", i, ":", value.toNumber(), "eur")
      totalEur += value.toNumber()
    }
  }
  return totalEur
}

async function getPoolBalances(account, pool) {
  const web3Instance = getWeb3(pool.chain)
  const isSingleRewardPool = pool.rewardTokenSymbols.length === 1

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

async function getEurValue(tokens, amounts, chain, usdEUR) {
  let value = 0
  for (let i = 0; i < tokens.length; i++) {
    let price = new BigNumber(await getTokenPrice(tokens[i], chain))
    let tokenValue = price.times(amounts[i]).div(usdEUR)
    value += tokenValue.toNumber()
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
  const health = totalBorrowed / (totalSupplied * 0.6) * 100
  return { supplied: totalSupplied, borrowed: totalBorrowed, health: health }
}

async function getTokenBalance(account, token, usdEUR) {
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
  const balanceEur = balance.times(price).div(usdEUR)
  return balanceEur.toNumber()
}

async function getUSDEUR() {
  const ethUSD = new BigNumber(await getTokenPriceById('WETH', 'usd'))
  const ethEUR = new BigNumber(await getTokenPriceById('WETH', 'eur'))
  return ethUSD.div(ethEUR).toNumber()
}

module.exports = {
  getNativeBalances,
  getPoolBalances,
  getEurValue,
  getRariBalance,
  getTokenBalance,
  getUSDEUR,
  isETH,
  isBTC,
  isSTABLE,
  isFARM
}
