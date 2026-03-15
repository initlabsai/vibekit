import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import {
  validateAddress,
  deriveApplicationAddress,
  algoToMicroAlgo,
  microAlgoToAlgo,
  calculateMinBalance,
} from './handlers/utilities'

export const utilityTools: ToolDefinition[] = [
  {
    name: 'validate_address',
    description:
      'Check if a string is a valid Algorand address. ' +
      'Validates the address format and checksum without requiring network calls.',
    parameters: z.object({
      address: z.string().describe('The address string to validate'),
    }),
    handler: async ({ args }) => validateAddress(args),
  },
  {
    name: 'get_application_address',
    description:
      'Derive an Algorand application address from its app ID. ' +
      'Application addresses are deterministic and can be derived without network calls. ' +
      'Useful for sending funds to an app or checking app balances.',
    parameters: z.object({
      appId: z.number().describe('The application ID to derive the address for'),
    }),
    handler: async ({ args }) => deriveApplicationAddress(args),
  },
  {
    name: 'algo_to_microalgo',
    description:
      'Convert ALGO to microALGO. ' +
      '1 ALGO = 1,000,000 microALGO. ' +
      'Useful for preparing transaction amounts.',
    parameters: z.object({
      algo: z.number().describe('Amount in ALGO to convert'),
    }),
    handler: async ({ args }) => algoToMicroAlgo(args),
  },
  {
    name: 'microalgo_to_algo',
    description:
      'Convert microALGO to ALGO. ' +
      '1 ALGO = 1,000,000 microALGO. ' +
      'Useful for displaying human-readable amounts.',
    parameters: z.object({
      microAlgo: z.number().describe('Amount in microALGO to convert'),
    }),
    handler: async ({ args }) => microAlgoToAlgo(args),
  },
  {
    name: 'calculate_min_balance',
    description:
      'Calculate the minimum balance requirement (MBR) for an Algorand account. ' +
      'MBR depends on assets opted into, apps created/opted into, and boxes. ' +
      'Note: This does not include global/local state schema costs (28,500 per uint, 50,000 per byte-slice) ' +
      "as those require knowing each app's schema.",
    parameters: z.object({
      numAssets: z
        .number()
        .optional()
        .describe('Number of assets opted into (includes created assets). Default: 0'),
      numCreatedApps: z
        .number()
        .optional()
        .describe('Number of apps created by this account. Default: 0'),
      numOptedInApps: z
        .number()
        .optional()
        .describe('Number of apps opted into (excluding created apps). Default: 0'),
      numExtraAppPages: z
        .number()
        .optional()
        .describe('Total extra app pages across all created apps. Default: 0'),
      numBoxes: z
        .number()
        .optional()
        .describe('Number of boxes across all apps created by this account. Default: 0'),
      totalBoxBytes: z
        .number()
        .optional()
        .describe(
          'Sum of (nameLength + valueSize) for all boxes. Each box costs 2,500 + 400 * bytes. Default: 0'
        ),
    }),
    handler: async ({ args }) => calculateMinBalance(args),
  },
]
