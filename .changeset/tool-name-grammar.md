---
'@initlabs/vibekit': minor
---

Three tool names now follow the grammar the rest use — `lookup_<entity>` reads one by id via the indexer, `get_<entity>_<facet>` reads a facet from algod or a file, `search_<entities>` filters a list, `list_*` enumerates: `app_get_info` is `get_application_info`, `app_list_methods` is `list_app_spec_methods`, and `search_asset_balances` is `search_asset_holders`. The paired indexer/algod tools describe when to use which.
