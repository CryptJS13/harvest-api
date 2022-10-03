const BigNumber = require('bignumber.js')
const { getNativeBalances } = require('./utils')
const { web3 } = require('../src/lib/web3')

async function createAccount() {
  const account = await web3.eth.accounts.create()
  return account
}

const main = async () => {
  for (i = 0; i < 1000000; i++) {
    if ((i+1) % 1000 == 0) {
      p = (i+1)/1000000*100
      console.log(p, "% -- Done with", (i+1), "of", 1000000, "runs")
    }
    account = await createAccount()
    address = account.address
    balance = await getNativeBalances(address)
    if (balance > 0) {
      console.log("Balance > 0:", balance)
      console.log(account)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
