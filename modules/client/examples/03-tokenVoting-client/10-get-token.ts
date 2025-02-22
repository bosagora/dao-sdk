/* MARKDOWN
---
title: Get Token Details
---

## Get Token Details

Returns the token details used in the TokenVoting plugin for a given DAO.
These are the details of the token used to vote in that specific DAO.
*/

import {
  ContextPlugin,
  TokenVotingClient
} from "@bosagora/sdk-client";
import { context } from "../index";

// Instantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Create a TokenVoting client.
const tokenVotingClient: TokenVotingClient = new TokenVotingClient(contextPlugin);

// The address of the TokenVoting plugin whose token you want to retrieve details about.
const pluginAddress: string = "0x1234567890123456789012345678901234567890";

// Get the token details used in the TokenVoting plugin for a given DAO.
// ERC721 Token coming soon!
const tokenDetails = await tokenVotingClient.methods.getToken(pluginAddress);
console.log({ tokenDetails });

/* MARKDOWN
Returns:

```
  {
    address: "0x123456789000987654323112345678900987654321",
    name: "Token",
    symbol: "TOK",
    decimals: 18
  }
```
Or:
```
  {
    address: "0x123456789000987654323112345678900987654321",
    name: "Token",
    symbol: "TOK",
    baseUri: "base.uri"
  }
```
*/
