/* MARKDOWN
---
title: ERC-20 Allowance
---

## Updates an ERC-20 Tokens' Allowance

In order for an address to deposit an ERC20 token into the DAO, the allowance approval for that token needs to be set to the amount the person wants to deposit.
This function ensures the allowance approval is set to that amount.
Refer to OpenZeppelin docs here on ERC20's token allowance methods: https://docs.openzeppelin.com/contracts/2.x/api/token/erc20#IERC20-allowance-address-address-).

This function updates the allowance approval to the amount specified.
*/

import {
  Client,
  DaoDepositSteps,
  UpdateAllowanceParams
} from "@bosagora/sdk-client";
import { context } from "../index";

// Instantiate the general purpose client from the Aragon OSx SDK context.
const client: Client = new Client(context);

const updateAllowanceParams: UpdateAllowanceParams = {
  daoAddressOrEns: "0x1234567890123456789012345678901234567890",
  amount: BigInt(10), // amount
  tokenAddress: "0x1234567890123456789012345678901234567890" // token contract adddress
};

const steps = client.methods.updateAllowance(updateAllowanceParams);

for await (const step of steps) {
  try {
    switch (step.key) {
      case DaoDepositSteps.CHECKED_ALLOWANCE:
        console.log(step.allowance); // 0n
        break;
      case DaoDepositSteps.UPDATING_ALLOWANCE:
        console.log(step.txHash); // 0xb1c14a49...3e8620b0f5832d61c
        break;
      case DaoDepositSteps.UPDATED_ALLOWANCE:
        console.log(step.allowance); // 10n
    }
  } catch (err) {
    console.error(err);
  }
}
