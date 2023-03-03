/* MARKDOWN
#### Decode the grant permission action

Decodes the parameters of a grant permission action.
*/

import {
  Client,
  IGrantPermissionDecodedParams
} from "@aragon/sdk-client";
import { context } from "../01-client/01-getting-started";

// Creates an Aragon OSx SDK client.
const client: Client = new Client(context);

const data: Uint8Array = new Uint8Array([12, 56]);

// Decodes the parameters of a grant permission action.
const grantParams: IGrantPermissionDecodedParams = client.decoding.grantAction(data);
console.log({ grantParams });

/* MARKDOWN
Returns:

```json
{
  who: "0x1234567890...",
  where: "0x1234567890...",
  permission: "UPGRADE_PERMISSION",
  permissionId: "0x12345..."
}
```
*/
