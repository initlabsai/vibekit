/**
 * LocalNet configuration content — a TS re-implementation of AlgoKit CLI's
 * sandbox.py (compose-file generation). Pure functions; no I/O.
 *
 * Reference: algorandfoundation/algokit-cli src/algokit/core/sandbox.py
 */

export const ALGORAND_IMAGE = 'algorand/algod:latest'
export const INDEXER_IMAGE = 'algorand/indexer:latest'
export const CONDUIT_IMAGE = 'algorandfoundation/conduit-localnet:latest'

export const LOCALNET_TOKEN = 'a'.repeat(64)

/** Compose project name of the localnet vibekit manages itself. */
export const LOCALNET_PROJECT = 'vibekit_localnet'

export const ALGOD_PORT = 4001
export const KMD_PORT = 4002
export const TEALDBG_PORT = 9392
export const INDEXER_PORT = 8980
export const POSTGRES_PORT = 5443

export function getComposeYaml(name: string = LOCALNET_PROJECT): string {
  return `name: "${name}"

services:
  algod:
    container_name: "${name}_algod"
    image: ${ALGORAND_IMAGE}
    ports:
      - ${ALGOD_PORT}:8080
      - ${KMD_PORT}:7833
      - ${TEALDBG_PORT}:9392
    environment:
      START_KMD: 1
      KMD_TOKEN: ${LOCALNET_TOKEN}
      TOKEN: ${LOCALNET_TOKEN}
      ADMIN_TOKEN: ${LOCALNET_TOKEN}
      GOSSIP_PORT: 10000
    init: true
    volumes:
      - type: bind
        source: ./algod_config.json
        target: /etc/algorand/config.json
      - type: bind
        source: ./algod_network_template.json
        target: /etc/algorand/template.json
      - ./goal_mount:/root/goal_mount

  conduit:
    container_name: "${name}_conduit"
    image: ${CONDUIT_IMAGE}
    restart: unless-stopped
    volumes:
      - type: bind
        source: ./conduit.yml
        target: /etc/algorand/conduit.yml
    depends_on:
      - indexer-db
      - algod

  indexer-db:
    container_name: "${name}_postgres"
    image: postgres:16-alpine
    ports:
      - ${POSTGRES_PORT}:5432
    user: postgres
    environment:
      POSTGRES_USER: algorand
      POSTGRES_PASSWORD: algorand
      POSTGRES_DB: indexerdb

  indexer:
    container_name: "${name}_indexer"
    image: ${INDEXER_IMAGE}
    ports:
      - ${INDEXER_PORT}:8980
    restart: unless-stopped
    command: daemon --enable-all-parameters
    environment:
      INDEXER_POSTGRES_CONNECTION_STRING: "host=indexer-db port=5432 user=algorand password=algorand dbname=indexerdb sslmode=disable"
    depends_on:
      - conduit
`
}

export function getAlgodConfigJson(): string {
  return (
    '{ "GossipFanout": 1, "EndpointAddress": "0.0.0.0:8080", "DNSBootstrapID": "",' +
    ' "IncomingConnectionsLimit": 0, "Archival":true, "isIndexerActive":false, "EnableDeveloperAPI":true,' +
    ' "EnablePrivateNetworkAccessHeader":true}'
  )
}

/**
 * Genesis network template for algod. NUM_ROUNDS is a placeholder substituted
 * by the algod container at startup. DevMode: instant blocks (one per txn).
 */
export function getAlgodNetworkTemplate(): string {
  return `{
    "Genesis": {
      "NetworkName": "followermodenet",
      "RewardsPoolBalance": 0,
      "FirstPartKeyRound": 0,
      "LastPartKeyRound": NUM_ROUNDS,
      "Wallets": [
        {
          "Name": "Wallet1",
          "Stake": 40,
          "Online": true
        },
        {
          "Name": "Wallet2",
          "Stake": 40,
          "Online": true
        },
        {
          "Name": "Wallet3",
          "Stake": 20,
          "Online": true
        }
      ],
      "DevMode": true
    },
    "Nodes": [
      {
        "Name": "data",
        "IsRelay": true,
        "Wallets": [
          {
            "Name": "Wallet1",
            "ParticipationOnly": false
          },
          {
            "Name": "Wallet2",
            "ParticipationOnly": false
          },
          {
            "Name": "Wallet3",
            "ParticipationOnly": false
          }
        ]
      },
      {
        "Name": "follower",
        "IsRelay": false,
        "ConfigJSONOverride":
        "{\\"EnableFollowMode\\":true,\\"EndpointAddress\\":\\"0.0.0.0:8081\\",\\"MaxAcctLookback\\":64,\\"CatchupParallelBlocks\\":64,\\"CatchupBlockValidateMode\\":3}"
      }
    ]
  }
`
}

export function getConduitYaml(): string {
  return `# Log verbosity: PANIC, FATAL, ERROR, WARN, INFO, DEBUG, TRACE
log-level: INFO

# Number of retries to perform after a pipeline plugin error.
retry-count: 10

# Time duration to wait between retry attempts.
retry-delay: "5s"

# Whether or not to print the conduit banner on startup.
hide-banner: false

# When enabled prometheus metrics are available on '/metrics'
metrics:
  mode: OFF
  addr: ":9999"
  prefix: "conduit"

# The importer is an algod follower node.
importer:
  name: localnet_algod
  config:
    lead-node-url: "http://algod:8080"
    follower-node-url: "http://algod:8081"
    token: "${LOCALNET_TOKEN}"

processors:

exporter:
  name: postgresql
  config:
    connection-string: "host=indexer-db port=5432 user=algorand password=algorand dbname=indexerdb"
    max-conn: 20
`
}

export type ComposeFileStatus = 'missing' | 'up-to-date' | 'out-of-date'

/**
 * Compare on-disk config contents against the latest generated ones.
 * Pass null for files that don't exist.
 */
export function composeFileStatus(onDisk: {
  compose: string | null
  algodConfig: string | null
  networkTemplate: string | null
}): ComposeFileStatus {
  if (onDisk.compose === null) return 'missing'
  if (onDisk.algodConfig === null || onDisk.networkTemplate === null) return 'out-of-date'
  return onDisk.compose === getComposeYaml() &&
    onDisk.algodConfig === getAlgodConfigJson() &&
    onDisk.networkTemplate === getAlgodNetworkTemplate()
    ? 'up-to-date'
    : 'out-of-date'
}
