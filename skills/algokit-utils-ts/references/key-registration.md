## Key registration

> All snippets in this section assume an `AlgorandClient` named `algorand` —
> see [Client initialization](#client-initialization) for setup.

### Register online with participation keys

Submit a key-registration transaction that marks an account as online for consensus participation.

```typescript
const result = await algorand.send.onlineKeyRegistration({
  sender: "SENDERADDRESS",
  voteKey: Uint8Array.from(Buffer.from("vote-key-base64", "base64")),
  selectionKey: Uint8Array.from(Buffer.from("selection-key-base64", "base64")),
  stateProofKey: Uint8Array.from(
    Buffer.from("state-proof-key-base64", "base64"),
  ),
  voteFirst: 1n,
  voteLast: 3_000_000n,
  voteKeyDilution: 1732n,
});
```

**What just happened:** You sent an online key-registration transaction via
`algorand.send.onlineKeyRegistration()`. The six participation-key fields
(`voteKey`, `selectionKey`, `stateProofKey`, `voteFirst`, `voteLast`,
`voteKeyDilution`) come from running `goal account addpartkey` (or the
equivalent REST endpoint) on a participation node. Once confirmed, the network
treats the sender account as online and eligible to propose and vote on blocks.

### Register offline (go offline)

Take an account offline so it no longer participates in consensus.

```typescript
const result = await algorand.send.offlineKeyRegistration({
  sender: "SENDERADDRESS",
});
```

**What just happened:** You sent an offline key-registration transaction via
`algorand.send.offlineKeyRegistration()`. Because no participation keys are
provided, the network clears the account's registered keys and marks it as
offline. The account stops proposing and voting on blocks but continues to hold
its balance normally. To permanently prevent the account from ever going back
online, pass `preventAccountFromEverParticipatingAgain: true` — use this with
caution as it is irreversible.
