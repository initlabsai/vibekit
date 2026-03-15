import { z } from 'zod'
import type { ToolDefinition } from '@vibekit/core'
import {
  appDeploy,
  appCall,
  appOptIn,
  appCloseOut,
  appDelete,
  appGetInfo,
  appListMethods,
} from './handlers/write'

export const contractWriteTools: ToolDefinition[] = [
  {
    name: 'app_deploy',
    description: `Deploy a new instance of a smart contract. Provide either appSpec (inline JSON) or appSpecPath (file path). Use appSpecPath for large app specs (>2KB) to avoid truncation.

Create patterns:
- Bare create (omit method): For contracts with no constructor or a parameterless create. Most contracts use this.
- ABI create (provide method + args): For contracts requiring constructor arguments. Specify the create method name (e.g., "createApplication", "create") and pass args.

Returns the new application ID and app address.`,
    parameters: z.object({
      appSpec: z
        .string()
        .optional()
        .describe('The ARC-56 or ARC-32 app spec JSON as a string. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
      method: z
        .string()
        .optional()
        .describe(
          'ABI method name for create (e.g., "createApplication"). If not provided, uses bare create.'
        ),
      args: z.array(z.any()).optional().describe('Arguments for the ABI create method, in order.'),
      deployTimeParams: z
        .record(z.any())
        .optional()
        .describe('Optional template parameters for deploy-time substitution'),
      sender: z
        .string()
        .optional()
        .describe(
          'Sender address. Must be an account in a KMD wallet (use list_accounts to see available). Defaults to the localnet dispenser if not specified.'
        ),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) =>
      appDeploy(algorand, args, resolveSender, resolveAppSpec),
  },
  {
    name: 'app_call',
    description:
      'Call an ABI method on a deployed smart contract. Supports three modes: (1) appSpec for inline type-safe calls, (2) appSpecPath for large specs from file, or (3) methodSignature for simple raw calls. One of appSpec, appSpecPath, or methodSignature must be provided.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z
        .string()
        .optional()
        .describe('The full ARC-56 or ARC-32 app spec JSON as a string. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
      methodSignature: z
        .string()
        .optional()
        .describe(
          'ARC-4 method signature (e.g., "hello(string)string"). Use for simple calls without the full app spec.'
        ),
      method: z
        .string()
        .optional()
        .describe(
          'Method name to call (required when using appSpec/appSpecPath). Ignored when using methodSignature.'
        ),
      args: z.array(z.any()).optional().describe('Method arguments in order'),
      sender: z.string().optional().describe('Sender address. Defaults to active account.'),
      extraFee: z
        .number()
        .optional()
        .describe('Extra fee in microALGO to cover inner transactions'),
      maxFee: z.number().optional().describe('Max fee in microALGO'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) =>
      appCall(algorand, args, resolveSender, resolveAppSpec),
  },
  {
    name: 'app_opt_in',
    description:
      'Opt an account into an application. Required before the account can have local state. Most contracts implement an ABI method for opt-in - provide appSpec/appSpecPath and method to use it. Use appSpecPath for large specs (>2KB). Falls back to a bare opt-in call if no method is specified.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z
        .string()
        .optional()
        .describe('App spec JSON for ABI method call. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
      method: z
        .string()
        .optional()
        .describe(
          'ABI method name for opt-in (e.g., "opt_in", "optIn"). Required with appSpec/appSpecPath.'
        ),
      args: z
        .array(z.any())
        .optional()
        .describe('Method arguments if the opt-in method requires them'),
      sender: z.string().optional().describe('Sender address. Defaults to active account.'),
      extraFee: z
        .number()
        .optional()
        .describe('Extra fee in microALGO to cover inner transactions'),
      maxFee: z.number().optional().describe('Max fee in microALGO'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) =>
      appOptIn(algorand, args, resolveSender, resolveAppSpec),
  },
  {
    name: 'app_close_out',
    description:
      'Close out of an application, removing local state for the account. Most contracts implement an ABI method for close-out - provide appSpec/appSpecPath and method to use it. Use appSpecPath for large specs (>2KB). Falls back to a bare close-out call if no method is specified.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z
        .string()
        .optional()
        .describe('App spec JSON for ABI method call. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
      method: z
        .string()
        .optional()
        .describe(
          'ABI method name for close-out (e.g., "close_out", "closeOut"). Required with appSpec/appSpecPath.'
        ),
      args: z
        .array(z.any())
        .optional()
        .describe('Method arguments if the close-out method requires them'),
      sender: z.string().optional().describe('Sender address. Defaults to active account.'),
      extraFee: z
        .number()
        .optional()
        .describe('Extra fee in microALGO to cover inner transactions'),
      maxFee: z.number().optional().describe('Max fee in microALGO'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) =>
      appCloseOut(algorand, args, resolveSender, resolveAppSpec),
  },
  {
    name: 'app_delete',
    description:
      'Delete an application. Only the creator can delete. Removes the app from the network. Most contracts implement an ABI method for deletion - provide appSpec/appSpecPath and method to use it. Use appSpecPath for large specs (>2KB). Falls back to a bare delete call if no method is specified.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
      appSpec: z
        .string()
        .optional()
        .describe('App spec JSON for ABI method call. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
      method: z
        .string()
        .optional()
        .describe(
          'ABI method name for deletion (e.g., "delete", "destroy"). Required with appSpec/appSpecPath.'
        ),
      args: z
        .array(z.any())
        .optional()
        .describe('Method arguments if the delete method requires them'),
      sender: z.string().optional().describe('Sender address. Defaults to active account.'),
      extraFee: z
        .number()
        .optional()
        .describe('Extra fee in microALGO to cover inner transactions'),
      maxFee: z.number().optional().describe('Max fee in microALGO'),
    }),
    handler: async ({ algorand, args, resolveSender, resolveAppSpec }) =>
      appDelete(algorand, args, resolveSender, resolveAppSpec),
  },
  {
    name: 'app_get_info',
    description:
      'Get information about a deployed application including creator, approval/clear programs, and state schema.',
    parameters: z.object({
      appId: z.number().describe('The application ID'),
    }),
    handler: async ({ algorand, args }) => appGetInfo(algorand, args),
  },
  {
    name: 'app_list_methods',
    description:
      'List available methods from an ARC-56/ARC-32 app spec. Provide either appSpec (inline JSON) or appSpecPath (file path). Use appSpecPath for large specs (>2KB) to avoid truncation.',
    parameters: z.object({
      appSpec: z
        .string()
        .optional()
        .describe('The ARC-56 or ARC-32 app spec JSON as a string. For small specs only.'),
      appSpecPath: z
        .string()
        .optional()
        .describe(
          'Path to ARC-56/ARC-32 app spec JSON file. Recommended for large specs (>2KB) to avoid truncation issues.'
        ),
    }),
    handler: async ({ args, resolveAppSpec }) => appListMethods(args, resolveAppSpec),
  },
]
