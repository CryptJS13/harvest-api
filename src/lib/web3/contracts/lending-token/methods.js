const { countFunctionCall } = require('../..')

const getBalance = (address, instance) =>
  countFunctionCall(instance.methods.balanceOf(address).call())

const getExchangeRate = instance =>
  countFunctionCall(instance.methods.exchangeRateStored().call())

const getBorrowBalance = (address, instance) => countFunctionCall(instance.methods.borrowBalanceStored(address).call())

const getSupplyRate = instance => countFunctionCall(instance.methods.borrowRatePerBlock().call())

const getBorrowRate = instance => countFunctionCall(instance.methods.supplyRatePerBlock().call())

const getUnderlying = instance => countFunctionCall(instance.methods.underlying().call())

module.exports = {
  getBalance,
  getExchangeRate,
  getBorrowBalance,
  getSupplyRate,
  getBorrowRate,
  getUnderlying,
}
