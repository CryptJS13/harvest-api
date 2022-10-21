const { countFunctionCall } = require('../..')

const getAccountLiquidity = (account, instance) =>
  countFunctionCall(instance.methods.getAccountLiquidity(account).call())
const getAssetsIn = (account, instance) =>
  countFunctionCall(instance.methods.getAssetsIn(account).call())

module.exports = {
  getAccountLiquidity,
  getAssetsIn,
}
