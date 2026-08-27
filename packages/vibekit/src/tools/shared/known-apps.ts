/**
 * Well-known mainnet application IDs → human labels. Protocol names live off
 * chain; without this map the model guesses (and misfiles Tinyman as Pact).
 * Routers, validators, factories, and registries only — never per-pool or
 * per-market apps: an absent label is an honest "unknown app".
 *
 * Sources: each protocol's official SDK constants; every id verified against
 * the mainnet indexer. Labels are stable descriptions, not marketing names.
 */
export const KNOWN_APPS: Readonly<Record<number, string>> = {
  // Tinyman
  350338509: 'Tinyman V1.0 AMM validator (legacy)',
  552635992: 'Tinyman V1.1 AMM validator',
  1002541853: 'Tinyman V2 AMM validator',
  1083651166: 'Tinyman Swap Router V1',
  2614712672: 'Tinyman Swap Router V2',
  3422861405: 'Tinyman Swap Router V3',
  649588853: 'Tinyman ASA staking',
  2537013674: 'Tinyman tALGO liquid staking',
  2537022861: 'Tinyman tALGO staking (stALGO)',
  2200606875: 'Tinyman governance vault',
  2200608153: 'Tinyman governance rewards',
  2200608887: 'Tinyman governance proposal voting',
  2200609638: 'Tinyman governance staking voting',
  // Pact (pools are per-pool apps — only the fixed contracts here)
  1027956681: 'Pact gas station',
  1072843805: 'Pact constant-product pool factory',
  1076423760: 'Pact NFT pool factory',
  1123472996: 'Pact Folks lending pool adapter',
  // Folks Finance
  3279848327: 'Folks Router (swap aggregator)',
  971350278: 'Folks Finance pool manager',
  971353536: 'Folks Finance deposits',
  1093729103: 'Folks Finance deposit staking',
  971368268: 'Folks Finance ALGO lending pool',
  971388781: 'Folks Finance loans (general)',
  971388977: 'Folks Finance loans (stablecoin efficiency)',
  971389489: 'Folks Finance loans (ALGO efficiency)',
  1202382736: 'Folks Finance loans (Ultraswap up)',
  1202382829: 'Folks Finance loans (Ultraswap down)',
  3184333108: 'Folks Finance loans (Algorand ecosystem)',
  793119194: 'Folks Finance gALGO dispenser',
  2629511242: 'Folks Finance liquid governance distributor',
  1134695678: 'Folks Finance xALGO consensus staking',
  2633147490: 'Folks Finance xALGO stake-and-deposit',
  1040271396: 'Folks Feed Oracle',
  // Deflex / Haystack (swaps run in per-swap apps deployed from the registries)
  951874839: 'Deflex/Haystack order router (legacy)',
  949209670: 'Deflex/Haystack registry v0',
  1147114926: 'Deflex/Haystack registry v1',
  949203488: 'Deflex/Haystack protocol treasury',
  // Vestige
  1222048105: 'Vestige V4 swap router',
  3129810607: 'Vestige ASA metadata manager',
  // AlgoFi (legacy, still referenced)
  818176933: 'AlgoFi V2 lending manager (legacy)',
  605753404: 'AlgoFi AMM pools manager (legacy)',
  // Bridges
  842125965: 'Wormhole core bridge',
  842126029: 'Wormhole token bridge (Portal)',
  3361283339: 'Allbridge Core bridge',
  3361289179: 'Allbridge Core USDC pool',
  // Names & registries
  760937186: 'NFDomains registry',
  3147789458: 'xGov Registry',
  // Alpha Arcade (markets are per-market apps)
  3078581851: 'Alpha Arcade order matcher',
  3626756314: 'Alpha Arcade ALPHA staking pool',
  3673221104: 'Alpha Arcade ALGO/USD perps pool',
  // Launchpads & misc
  2020762574: 'rug.ninja launchpad',
  1257620981: 'Bonfire (ASA burner)',
}

/** The label for a mainnet app id, if it is a known protocol contract. */
export function knownAppLabel(applicationId: number): string | undefined {
  return KNOWN_APPS[applicationId]
}
