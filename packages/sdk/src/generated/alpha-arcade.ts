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
    yesPrice: string | undefined;
    noPrice: string | undefined;
    volume: number | undefined;
    endTs: number;
    resolution: number | undefined;
    isResolved: boolean | undefined;
    isLive: boolean | undefined;
    categories: string[] | undefined;
    featured: boolean | undefined;
    feeBase: number | undefined;
    totalRewards: number | undefined;
    rewardsPaidOut: number | undefined;
    rewardsSpreadDistance: number | undefined;
    rewardsMinContracts: number | undefined;
    lastRewardAmount: number | undefined;
    lastRewardTs: number | undefined;
    options: {
        id: string;
        title: string;
        marketAppId: number;
        yesPrice: string | undefined;
        noPrice: string | undefined;
    }[] | undefined;
    source: "onchain" | "api" | undefined;
}

export type FormattedOrderbook = {
    yes: {
        bids: {
            price: string;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
        asks: {
            price: string;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
    };
    no: {
        bids: {
            price: string;
            quantity: number;
            escrowAppId: number;
            owner: string;
        }[];
        asks: {
            price: string;
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
    price: string;
    quantity: number;
    quantityFilled: number;
    slippage: number;
    owner: string;
}
