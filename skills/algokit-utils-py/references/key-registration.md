## Key registration

> All snippets in this section assume an `AlgorandClient` named `algorand` —
> see [Client initialization](#client-initialization) for setup.

### Register online with participation keys

Submit a key-registration transaction that marks an account as online for consensus participation.

```python
from algokit_utils import OnlineKeyRegistrationParams

result = algorand.send.online_key_registration(OnlineKeyRegistrationParams(
    sender=account.addr,
    vote_key="VOTEKEY_BASE64",
    selection_key="SELECTIONKEY_BASE64",
    state_proof_key=b"STATE_PROOF_KEY_64_BYTES_HERE_________________________________",
    vote_first=1,
    vote_last=3_000_000,
    vote_key_dilution=1732,
))
```

**What just happened:** You sent an online key-registration transaction via `algorand.send.online_key_registration()`. The six participation-key fields (`vote_key`, `selection_key`, `state_proof_key`, `vote_first`, `vote_last`, `vote_key_dilution`) come from running `goal account addpartkey` (or the equivalent REST endpoint) on a participation node. Once confirmed, the network treats the sender account as online and eligible to propose and vote on blocks.

### Register offline (go offline)

Take an account offline so it no longer participates in consensus.

```python
from algokit_utils import OfflineKeyRegistrationParams

result = algorand.send.offline_key_registration(OfflineKeyRegistrationParams(
    sender=account.addr,
))
```

**What just happened:** You sent an offline key-registration transaction via `algorand.send.offline_key_registration()`. Because no participation keys are provided, the network clears the account's registered keys and marks it as offline. The account stops proposing and voting on blocks but continues to hold its balance normally. To permanently prevent the account from ever going back online, pass `prevent_account_from_ever_participating_again=True` — use this with caution as it is irreversible.
