# Algorand sources

Use this map when maintaining `build-on-algorand`. Verify claims against the
live source rather than copying large sections into the skill.

## Smart contracts and the AVM

- [Smart-contract overview](https://dev.algorand.co/concepts/smart-contracts/overview/)
- [Algorand TypeScript language guide](https://dev.algorand.co/concepts/smart-contracts/languages/typescript/)
- [AVM overview](https://dev.algorand.co/concepts/smart-contracts/avm/)
- [Costs and constraints](https://dev.algorand.co/concepts/smart-contracts/costs-constraints/)
- [Resource usage](https://dev.algorand.co/concepts/smart-contracts/resource-usage/)
- [Storage overview](https://dev.algorand.co/concepts/smart-contracts/storage/overview/)
- [Box storage](https://dev.algorand.co/concepts/smart-contracts/storage/box/)
- [Protocol 5.0 release](https://github.com/algorand/go-algorand/releases/tag/v5.0.0-stable)

Review newer protocol releases when refreshing the skill. Keep only changes
that affect application design, compiler output, testing, fees, resources, or
security; do not turn the skill into release notes.

## PuyaTs

Start with the maintained example collections:

- [PuyaTs examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples)
- [Focused devportal examples](https://github.com/algorandfoundation/puya-ts/tree/main/examples/devportal)
- [Type semantics](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/language-guide/types.md)
- [Inner transactions](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/language-guide/itxns.md)
- [Migration guides](https://github.com/algorandfoundation/puya-ts/blob/main/docs/src/content/docs/migration-guides.md)
- [Security policy](https://github.com/algorandfoundation/puya-ts/blob/main/SECURITY.md)

Focused examples currently used by the skill include
[hello world](https://github.com/algorandfoundation/puya-ts/blob/main/examples/hello-world-abi/contract.algo.ts),
[auction](https://github.com/algorandfoundation/puya-ts/blob/main/examples/auction/contract.algo.ts),
[voting](https://github.com/algorandfoundation/puya-ts/blob/main/examples/voting/contract.algo.ts),
[ARC-4 options](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/abimethod_options/contract.algo.ts),
[ARC-4 types](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/arc4_types/contract.algo.ts),
[cross-contract ARC-4 calls](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/arc4_client/contract.algo.ts),
[contract options](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/contract_options/contract.algo.ts),
[events](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/events/contract.algo.ts),
[global state](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/global_state/contract.algo.ts),
[local state](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/local_state/contract.algo.ts),
[boxes](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/box_storage/contract.algo.ts),
[group transactions](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/group_transactions/contract.algo.ts),
[inner transactions](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/inner_transactions/contract.algo.ts),
and [opcode budget](https://github.com/algorandfoundation/puya-ts/blob/main/examples/devportal/op_budget/contract.algo.ts).

Preserve the contract/off-chain TypeScript boundary. Re-check restricted
language behavior, AVM-native types such as `uint64` and `bytes`, reference
semantics, `clone(value)`, storage proxies, and generated ARC-56 output when
PuyaTs changes.

## Clients and tests

- [TypeScript client-generator guide](https://dev.algorand.co/algokit/client-generator/typescript/)
- [TypeScript unit-testing guide](https://dev.algorand.co/algokit/unit-testing/typescript/overview/)
- [AlgoKit Utils TypeScript examples](https://github.com/algorandfoundation/algokit-utils-ts/tree/docs-staging/examples)
- [Application example](https://github.com/algorandfoundation/algokit-utils-ts/blob/docs-staging/examples/concepts/applications.algo.ts)
- [Transaction example](https://github.com/algorandfoundation/algokit-utils-ts/blob/docs-staging/examples/concepts/transactions.algo.ts)

The AlgoKit Utils examples intentionally use `docs-staging`, which currently
contains the latest documentation examples. Re-check `main` on each update and
switch only after the examples are merged and equivalent or newer.

## Frontend wallets

- [TxnLab use-wallet skill](https://github.com/TxnLab/skills/tree/main/skills/use-wallet)
- [use-wallet-ui](https://github.com/TxnLab/use-wallet-ui)
- [VibeKit starter wallet setup](https://github.com/initlabsai/algorand-starter-fullstack/blob/main/app/src/App.tsx)
- [VibeKit starter generated-client call](https://github.com/initlabsai/algorand-starter-fullstack/blob/main/app/src/components/AppCalls.tsx)

Keep this section minimal because TxnLab's skill is available as an optional
remote catalog. Verify the installed major version, SSR lifecycle, network API,
and signer shape before changing examples.

## ARCs

Use the [ARC repository](https://github.com/algorandfoundation/ARCs/tree/main/ARCs)
and [developer-portal index](https://dev.algorand.co/arc-standards/) for live
status. The selected application and asset standards currently come from:

- [ARC-2](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0002.md), [ARC-3](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0003.md), [ARC-4](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0004.md)
- [ARC-18](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0018.md), [ARC-19](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0019.md), [ARC-20](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0020.md), [ARC-28](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0028.md)
- [ARC-55](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0055.md), [ARC-56](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0056.md), [ARC-69](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0069.md)
- [ARC-72](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0072.md), [ARC-89](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0089.md), and [ARC-200](https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0200.md)

ARC-32 belongs only in migration or named compatibility guidance. Exclude
legacy wallet standards and withdrawn standards from the normal selection.
Re-check supersession and adoption before recommending a newer standard.

## x402

- [Algorand x402 overview](https://dev.algorand.co/resources/x402-on-algorand/)
- [GoPlausible facilitator guide](https://facilitator.goplausible.xyz/guide)
- [Algorand x402 library README](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/README.md)
- [Simplified and custom-facilitator example](https://github.com/algorandfoundation/WAD-26-x402-demo)

x402 changes quickly and its documentation quality varies. Keep only an
orientation, distinguish the ecosystem facilitator from a custom facilitator,
and direct the agent to current integration sources.

## Upstream provenance

`build-on-algorand` materially adapts the MIT-licensed
[`algorand-devrel/algorand-agent-skills`](https://github.com/algorand-devrel/algorand-agent-skills)
reviewed at
[`35d7e65be978b14e1777fb37c4a70fa92fe8022e`](https://github.com/algorand-devrel/algorand-agent-skills/commit/35d7e65be978b14e1777fb37c4a70fa92fe8022e).
Preserve `build-on-algorand/ATTRIBUTION.md` while adapted material remains.
