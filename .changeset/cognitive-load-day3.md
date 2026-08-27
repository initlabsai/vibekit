---
'@initlabs/vibekit': patch
---

`asset_create` now validates `freeze` and `clawback` addresses the way it validates `manager` and `reserve` (a bad address is `INVALID_ADDRESS`, not a deep algosdk error). Interface/schema drift guards cover the account, asset, and program wire shapes; `app_deploy`/`app_update` resolve ABI methods from the spec they already normalized.
