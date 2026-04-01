// Auto-generated from @vibekit/alpha-arcade — do not edit manually.
// Run `bun run sync-types` to regenerate.

export type FormattedMarket = {
    id: string;
    title: string;
    slug: string | undefined;
    image: string | undefined;
    marketAppId: number;
    yesAssetId: number;
    noAssetId: number;
    yesPriceUsd: number | undefined;
    yesProb: number | undefined;
    noPriceUsd: number | undefined;
    noProb: number | undefined;
    volumeUsd: number | undefined;
    endTs: number;
    resolution: number | undefined;
    isResolved: boolean | undefined;
    isLive: boolean | undefined;
    categories: string[] | undefined;
    featured: boolean | undefined;
    feeBase: number | undefined;
    totalRewardsUsd: number | undefined;
    rewardsPaidOutUsd: number | undefined;
    rewardsSpreadDistance: number | undefined;
    rewardsMinContracts: number | undefined;
    lastRewardAmountUsd: number | undefined;
    lastRewardTs: number | undefined;
    options: {
        id: string;
        title: string;
        marketAppId: number;
        yesPriceUsd: number | undefined;
        yesProb: number | undefined;
        noPriceUsd: number | undefined;
        noProb: number | undefined;
    }[] | undefined;
    source: "onchain" | "api" | undefined;
}

export type FormattedOrderbook = {
    yes: {
        bids: {
            priceUsd: number;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
        asks: {
            priceUsd: number;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
    };
    no: {
        bids: {
            priceUsd: number;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
        asks: {
            priceUsd: number;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
    };
}

export type FormattedPosition = {
    marketAppId: number;
    title: string;
    yesAssetId: number;
    noAssetId: number;
    yesBalance: number;
    noBalance: number;
}

export type FormattedOpenOrder = {
    escrowAppId: number;
    marketAppId: number;
    position: string;
    side: string;
    priceUsd: number;
    quantity: number;
    quantityFilled: number;
    slippageUsd: number;
    owner: string;
}
