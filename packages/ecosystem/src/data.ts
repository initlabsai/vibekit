export type EcosystemCategory =
  | 'defi'
  | 'wallets'
  | 'bridges'
  | 'explorers'
  | 'impact'
  | 'nfts'
  | 'rwa'
  | 'devtools'

export const ECOSYSTEM_CATEGORIES: Record<EcosystemCategory, string> = {
  defi: 'DeFi Protocols',
  wallets: 'Wallets',
  bridges: 'Bridges & Swap Tools',
  explorers: 'Explorers & Dashboards',
  impact: 'Impact Projects',
  nfts: 'NFTs (Marketplaces & Tools)',
  rwa: 'Real World Assets',
  devtools: 'Developer Tools',
}

export interface EcosystemProject {
  id: string
  name: string
  category: EcosystemCategory
  description: string
  features: string[]
  website?: string
  docs?: string
  github?: string
  twitter?: string
}

export const projects: EcosystemProject[] = [
  // ── Wallets ──
  {
    id: 'pera-wallet',
    name: 'Pera Wallet',
    category: 'wallets',
    description:
      'The most popular self-custodial Algorand wallet. Supports ALGO, ASAs, NFTs, built-in swaps, staking, and dApp connections.',
    features: [
      'Self-custodial',
      'Built-in swaps',
      'Staking',
      'Fiat on-ramp',
      'Mobile + Web',
      'Open-source',
    ],
    website: 'https://perawallet.app/',
    github: 'https://github.com/perawallet/pera-wallet',
    twitter: 'https://x.com/PeraAlgoWallet',
  },
  {
    id: 'lute-wallet',
    name: 'Lute Wallet',
    category: 'wallets',
    description:
      'Web-based Algorand wallet with strong Ledger hardware wallet support. Available as a web app and Chrome extension.',
    features: [
      'Web wallet',
      'Chrome extension',
      'Ledger support',
      'Rekeyed accounts',
      'Multi-network',
      'Snoop Mode',
    ],
    website: 'https://lute.app/',
    github: 'https://github.com/GalaxyPay/lute-connect',
    twitter: 'https://x.com/LuteWallet',
  },
  {
    id: 'defly-wallet',
    name: 'Defly Wallet',
    category: 'wallets',
    description:
      'DeFi-optimized mobile wallet with advanced trading tools, in-app swaps across multiple DEXs, limit orders, and portfolio tracking.',
    features: [
      'DeFi-focused',
      'Multi-DEX swaps',
      'Limit orders',
      'Portfolio tracking',
      'Ledger support',
      'Multisig',
    ],
    website: 'https://defly.app/',
    docs: 'https://defly.gitbook.io/defly-manual/',
    twitter: 'https://x.com/deflyapp',
  },

  // ── DeFi ──
  {
    id: 'folks-finance',
    name: 'Folks Finance',
    category: 'defi',
    description:
      'The largest DeFi protocol on Algorand. Non-custodial lending, borrowing, liquid staking (gALGO/xALGO), and DEX aggregation via Folks Router.',
    features: [
      'Lending & borrowing',
      'Liquid staking',
      'DEX aggregator',
      'Cross-chain',
      'Governance integration',
    ],
    website: 'https://folks.finance',
    github: 'https://github.com/Folks-Finance/folks-router',
  },
  {
    id: 'tinyman',
    name: 'Tinyman',
    category: 'defi',
    description:
      'Leading decentralized exchange (DEX) and AMM on Algorand for swapping ASAs, providing liquidity, and yield farming.',
    features: ['Token swaps', 'Liquidity pools', 'Yield farming', 'Staking', 'Governance'],
    website: 'https://tinyman.org/',
    github: 'https://github.com/tinymanorg/tinyman-amm-contracts-v2',
    twitter: 'https://x.com/tinymanorg',
  },
  {
    id: 'pact',
    name: 'Pact',
    category: 'defi',
    description:
      'Decentralized exchange (AMM) on Algorand for token swaps, liquidity provision, and LP staking rewards.',
    features: ['Token swaps', 'Liquidity pools', 'LP farming'],
    website: 'https://www.pact.fi',
    github: 'https://github.com/pactfi/pact-js-sdk',
    twitter: 'https://x.com/pact_fi',
  },
  {
    id: 'haystack',
    name: 'Haystack',
    category: 'defi',
    description:
      'Mobile-first DeFi app for trading, swapping, token launches, and yield earning on Algorand.',
    features: ['Mobile-first', 'Token launches', 'Aggregated swaps', 'Auto-yield', 'Social login'],
    website: 'https://hay.app',
    github: 'https://github.com/TxnLab/haystack-js',
    twitter: 'https://x.com/haydotapp',
  },
  {
    id: 'vestige',
    name: 'Vestige',
    category: 'defi',
    description:
      'All-in-one DeFi platform with a swap aggregator, portfolio tracking, price charting, and ASA analytics.',
    features: [
      'Swap aggregator',
      'Portfolio tracking',
      'Price charts',
      'ASA analytics',
      'Trending explorer',
    ],
    website: 'https://vestige.fi/',
    docs: 'https://api.vestigelabs.org/docs',
    github: 'https://github.com/vestigefi/widgets',
    twitter: 'https://x.com/vestigefi',
  },
  {
    id: 'alpha-arcade',
    name: 'AlphaArcade',
    category: 'defi',
    description:
      'Decentralized prediction market on Algorand. Bet on sports, crypto, politics, and more with limit order book trading.',
    features: [
      'Prediction markets',
      'Order book trading',
      'Fee distribution to $ALPHA holders',
      'LP rewards',
      'SDK/API',
    ],
    website: 'https://www.alphaarcade.com/',
    github: 'https://github.com/phara23/alpha-sdk',
    twitter: 'https://x.com/alphaarcade',
  },

  // ── Bridges ──
  {
    id: 'xo-swap',
    name: 'XO Swap',
    category: 'bridges',
    description:
      'Cross-chain swap aggregator by Exodus supporting 50+ networks including Algorand. Fast, secure swaps without KYC.',
    features: ['Cross-chain swaps', '50+ networks', 'No KYC', 'Wallet integration'],
    website: 'https://www.xoswap.com/',
    docs: 'https://www.xoswap.com/docs',
    twitter: 'https://x.com/XO_Swap',
  },
  {
    id: 'simple-swap',
    name: 'SimpleSwap',
    category: 'bridges',
    description:
      'Instant non-custodial crypto swap service supporting 2,500+ cryptocurrencies. No registration required.',
    features: ['2,500+ cryptos', 'No registration', 'Non-custodial', 'Fiat support'],
    website: 'https://simpleswap.io/',
    docs: 'https://simpleswap.io/en/affiliate-program/how-to-start/api',
    twitter: 'https://x.com/SimpleSwap_io',
  },
  {
    id: 'allbridge',
    name: 'Allbridge',
    category: 'bridges',
    description:
      'Cross-chain bridge for native stablecoin transfers (USDC) between Algorand and other chains. Native assets, not wrapped.',
    features: ['Native asset bridging', 'USDC transfers', 'Multi-chain', 'No wrapped tokens'],
    website: 'https://allbridge.io/',
    docs: 'https://docs-core.allbridge.io/sdk/allbridge-core-rest-api',
  },
  {
    id: 'wormhole-ntt',
    name: 'Wormhole NTT',
    category: 'bridges',
    description:
      'Wormhole Native Token Transfer framework for cross-chain token transfers without liquidity pools. Burns and mints or locks and mints.',
    features: ['No liquidity pools', 'Burn & mint', 'Lock & mint', 'Direct transfers'],
    docs: 'https://dev.algorand.co/resources/bridging/',
  },

  // ── Explorers ──
  {
    id: 'allo',
    name: 'Allo',
    category: 'explorers',
    description:
      'Modern, full-featured Algorand explorer. Browse assets, accounts, apps, blocks, transactions, NFDs, and ecosystem projects.',
    features: ['Full explorer', 'TEAL inspector', 'Network metrics', 'Ecosystem directory'],
    website: 'https://allo.info/',
  },
  {
    id: 'algo-surf',
    name: 'Algo Surf',
    category: 'explorers',
    description:
      'Algorand blockchain analysis suite for tracking ALGO flows, wallet behavior, CSV exports, and bulk balance lookups.',
    features: [
      'Flow analysis',
      'CSV export (Clerk)',
      'Bulk balance lookup (Batch)',
      'Wallet analytics',
    ],
    website: 'https://algo.surf/',
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'explorers',
    description:
      'Interactive developer explorer for Algorand. Inspect any network (LocalNet, TestNet, MainNet), deploy, simulate, and debug smart contracts.',
    features: ['Developer-focused', 'All networks', 'Smart contract tools', 'Deploy & simulate'],
    website: 'https://lora.algokit.io/',
    github: 'https://github.com/algorandfoundation/algokit-lora',
  },
  {
    id: 'pera-explorer',
    name: 'Pera Explorer',
    category: 'explorers',
    description:
      'Algorand blockchain explorer by the Pera Wallet team. Browse transactions, assets, addresses, applications, and blocks.',
    features: ['Full explorer', 'Inner transactions', 'MainNet + TestNet'],
    website: 'https://explorer.perawallet.app/',
  },
  {
    id: 'nodely-dashboard',
    name: 'Nodely Dashboard',
    category: 'explorers',
    description:
      'Real-time Algorand network analytics dashboard with TPS analysis, node metrics, decentralization data, and ledger insights.',
    features: ['TPS analysis', 'Node metrics', 'Decentralization stats', 'Ledger analytics'],
    website: 'https://g.nodely.io/dashboards',
    docs: 'https://nodely.io/docs/free/start',
  },
  {
    id: 'defi-llama',
    name: 'DeFi Llama',
    category: 'explorers',
    description:
      'Cross-chain DeFi analytics platform. For Algorand: TVL, stablecoin supply, fees, revenue, DEX volume, and protocol metrics.',
    features: ['TVL tracking', 'Stablecoin supply', 'DEX volume', 'Protocol analytics'],
    website: 'https://defillama.com/chain/algorand',
  },
  {
    id: 'algorand-metrics-portal',
    name: 'Algorand Metrics Portal',
    category: 'explorers',
    description:
      'Curated hub aggregating on-chain, ecosystem, and sustainability data from Nodely, DeFi Llama, Nansen, Vestige, and more.',
    features: ['Aggregated metrics', 'Network health', 'Ecosystem data', 'Sustainability'],
    website: 'https://algorand.co/metrics',
  },
  {
    id: 'algorand-energy-dashboard',
    name: 'Algorand Energy Dashboard',
    category: 'explorers',
    description:
      'Open-source dashboard visualizing Algorand network energy consumption, annualized usage, and greenhouse-gas footprint.',
    features: ['Energy consumption', 'Emissions tracking', 'Open-source'],
    website: 'https://cusma.github.io/algorand-energy/',
  },

  // ── Developer Tools ──
  {
    id: 'vibekit',
    name: 'Vibekit',
    category: 'devtools',
    description:
      'The agentic stack for Algorand builders. AI-powered framework with 11 agent skills and 44 blockchain operations for compiling, testing, deploying, and troubleshooting smart contracts using natural language. Also includes an AI-powered blockchain explorer.',
    features: ['Agentic AI framework', 'Smart contract lifecycle', 'Secure key management', 'AI blockchain explorer'],
    website: 'https://getvibekit.ai/',
    github: 'https://github.com/gabrielkuettel/vibekit',
  },

  // ── Impact ──
  {
    id: 'aid-tech',
    name: 'AID:Tech',
    category: 'impact',
    description:
      'Blockchain-based social impact platform for humanitarian aid, disaster relief, and programmable payments using stablecoin disbursements.',
    features: ['Humanitarian aid', 'Programmable payments', 'Digital identity', 'Kare Wallet'],
    website: 'https://www.aid.technology/',
    twitter: 'https://x.com/aidtechnology',
  },
  {
    id: 'hesab-pay',
    name: 'HesabPay',
    category: 'impact',
    description:
      'Digital payments platform operating in Afghanistan and Syria. First interoperable digital payments solution with mobile wallet, bill pay, and remittances.',
    features: ['Mobile wallet', 'Bill payments', 'Remittances', 'USSD support', 'QR payments'],
    website: 'https://hesab.com/',
    twitter: 'https://x.com/HesabPay_',
  },
  {
    id: 'wholechain',
    name: 'Wholechain',
    category: 'impact',
    description:
      'Blockchain-based supply chain traceability platform on Algorand. Item-level tracking from origin to retail with tamper-proof records.',
    features: [
      'Supply chain tracing',
      'Item-level tracking',
      'Compliance',
      'Sustainability verification',
    ],
    website: 'https://wholechain.com/',
  },

  // ── NFTs ──
  {
    id: 'downbad',
    name: 'Downbad',
    category: 'nfts',
    description:
      'Prominent NFT marketplace on Algorand for discovering, buying, selling, and trading NFTs. Features Shuffles and NFT staking.',
    features: ['NFT marketplace', 'Shuffles', 'NFT staking', 'Collections explorer'],
    website: 'https://www.downbad.farm',
  },
  {
    id: 'rand-gallery',
    name: 'Rand Gallery',
    category: 'nfts',
    description:
      'The longest-running Algorand NFT marketplace. Mint, buy, sell, and explore NFTs. Acquired by Goanna DAO.',
    features: ['NFT marketplace', 'Minting', 'Trending collections', 'Activity feeds'],
    website: 'https://www.randgallery.com/',
  },
  {
    id: 'wen-tools',
    name: 'Wen Tools',
    category: 'nfts',
    description:
      'Suite of free, open-source, no-code tools for Algorand. Mint NFTs, bulk send assets, airdrops, and token management.',
    features: ['No-code minting', 'Bulk send', 'Airdrops', 'Batch opt-in', 'Token management'],
    website: 'https://www.wen.tools/',
  },
  {
    id: 'minthol',
    name: 'Minthol',
    category: 'nfts',
    description:
      'NFT browser and analytics tool for Algorand. Browse, view, and analyze NFT collections and data.',
    features: ['NFT browser', 'Collection analytics', 'Data aggregation'],
    website: 'https://www.minthol.art/',
  },
  {
    id: 'nfdomains',
    name: 'NFDomains',
    category: 'nfts',
    description:
      'Algorand native name service for .algo domains. Human-readable Web3 identities tied to wallet addresses.',
    features: ['.algo domains', 'Name service', 'Identity', 'Marketplace'],
    website: 'https://app.nf.domains/',
    docs: 'https://api-docs.nf.domains/',
    github: 'https://github.com/TxnLab/nfd-sdk',
  },
  {
    id: 'goplausible',
    name: 'GoPlausible',
    category: 'nfts',
    description:
      'Identity, credentialing, and AI-agent infrastructure on Algorand. W3C-compliant DIDs, Verifiable Credentials, OpenBadges, and MCP integration.',
    features: [
      'Decentralized identity',
      'Verifiable Credentials',
      'OpenBadges',
      'MCP integration',
      'x402',
    ],
    website: 'https://goplausible.com/',
  },

  // ── RWA ──
  {
    id: 'meld-gold',
    name: 'Meld Gold',
    category: 'rwa',
    description:
      'Tokenized physical gold and silver on Algorand. Buy, sell, transfer, or redeem fractional precious metals digitally.',
    features: ['Tokenized gold', 'Tokenized silver', 'Fractional ownership', 'Redeemable'],
    website: 'https://www.meld.gold/',
  },
  {
    id: 'lofty',
    name: 'Lofty AI',
    category: 'rwa',
    description:
      'Fractional real estate investment platform on Algorand. Invest in U.S. rental properties from $50, earn daily USDC rental income.',
    features: [
      'Fractional real estate',
      'Daily USDC income',
      '$50 minimum',
      'Secondary market',
      'DAO governance',
    ],
    website: 'https://www.lofty.ai/',
  },
]
