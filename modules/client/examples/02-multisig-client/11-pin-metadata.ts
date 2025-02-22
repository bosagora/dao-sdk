/* MARKDOWN
---
title: Pin Metadata
---

## Add and Pin Metadata for the Multisig plugin

Adds an pin data into one of the specified IPFS nodes and return a IPFS CID preceded by "ipfs://"
*/

import {
  ContextPlugin,
  MultisigClient,
  ProposalMetadata
} from "@bosagora/sdk-client";
import { context } from "../index";

// Instantiate a plugin context from the Aragon OSx SDK context.
const contextPlugin: ContextPlugin = ContextPlugin.fromContext(context);
// Instantiate a Multisig plugin client.
const multisigClient: MultisigClient = new MultisigClient(contextPlugin);

const metadata: ProposalMetadata = {
  title: "Test Proposal",
  summary: "This is a short description",
  description: "This is a long description",
  resources: [
    {
      name: "Discord",
      url: "https://discord.com/..."
    },
    {
      name: "Website",
      url: "https://website..."
    },
  ],
  media: {
    logo: "https://...",
    header: "https://..."
  },
};

const metadataUri: string = await multisigClient.methods.pinMetadata(metadata);
console.log({ metadataUri });

/* MARKDOWN
Returns:

```json
  { metadataUri: "ipfs://Qm..." }
```
*/
