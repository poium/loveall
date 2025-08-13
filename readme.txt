Client ID : f7302a61-dc9b-4b5e-aef5-016ec237a9d0
API Key: F4DD9331-A388-40D3-A869-0719AF18228F
Your Signer UUID:3231f0e6-7c59-47d8-9c9c-7ef5faa2f24d

import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const neynarClient = new NeynarAPIClient({ 
  apiKey: "undefined"
});
const signerUuid = "3231f0e6-7c59-47d8-9c9c-7ef5faa2f24d";
const text = "Hello, World! 🪐";

neynarClient.publishCast({
    signerUuid,
    text,

}).then((response) => {
  console.log("cast:", response.cast);
});


curl --request POST \
     --url https://api.neynar.com/v2/farcaster/cast \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --header 'x-api-key: undefined' \
     --data '
{
  "signer_uuid": "3231f0e6-7c59-47d8-9c9c-7ef5faa2f24d",
  "text": "Hello, World! 🪐"
}
'


------
