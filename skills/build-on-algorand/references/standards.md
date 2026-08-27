# Algorand standards

Use an ARC because a current consumer needs interoperability, not because it
appears in a broad checklist. Read the live specification and adoption data
before implementing it.

## Normal application path

- [ARC-4](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0004.md)
  defines ABI method signatures, selectors, argument/return encoding, and
  interfaces. Use it for public application methods.
- [ARC-56](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0056.md)
  extends the application description with state, structs, events, source
  information, actions, and other data used by generated clients. Prefer it
  for new application artifacts.
- [ARC-28](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0028.md)
  defines structured application events. Use it when an indexer, client, or
  integration consumes typed logs.

## ASA and digital-asset choices

- [ARC-3](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0003.md)
  defines off-chain JSON metadata conventions for fungible and non-fungible
  ASAs. It remains the basic compatibility choice for ASA metadata.
- [ARC-19](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0019.md)
  defines mutable NFT URL templating, and
  [ARC-69](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0069.md)
  defines digital-media metadata in asset-config notes. Both are Final but are
  marked as superseded by ARC-89; support them when integrating existing
  assets and consumers.
- [ARC-89](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0089.md)
  proposes an ASA metadata registry and supersedes ARC-19/69. It is currently
  Last Call. For a new design, verify its latest status, trusted deployments,
  implementation maturity, and wallet/marketplace support before choosing it.
- [ARC-20](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0020.md)
  defines a Smart ASA controlled through an ARC-4 application. Use it only
  when the product needs contract-enforced asset behavior and its consumers
  support the interface.

Do not combine ARC-3, ARC-19, ARC-69, ARC-89, and ARC-20 by default. Choose the
smallest model that satisfies mutability, custody, metadata, and ecosystem
requirements.

## Specialized standards

Read these only when the corresponding feature exists:

- [ARC-2 transaction notes](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0002.md)
- [ARC-18 royalties](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0018.md)
- [ARC-55 on-chain multisig coordination](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0055.md)
- [ARC-72 application-based NFTs](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0072.md),
  currently Living
- [ARC-200 application-based tokens](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0200.md),
  currently Living

Legacy and withdrawn standards are omitted from this selection. Consult the
repository history only when maintaining an integration that already depends
on one.

Browse the [ARC repository](https://github.com/algorandfoundation/ARCs/tree/main/ARCs)
or [developer-portal index](https://dev.algorand.co/arc-standards/) for current
status and category information.
