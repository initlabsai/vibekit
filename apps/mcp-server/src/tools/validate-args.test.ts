import { describe, it, expect } from 'vitest'
import { validateArgs } from './types.js'

describe('validateArgs', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      receiver: { type: 'string', description: 'The receiver address' },
      amount: { type: 'number', description: 'Amount in microALGO' },
      note: { type: 'string', description: 'Optional note' },
    },
    required: ['receiver', 'amount'],
  }

  it('passes valid args with all required fields', () => {
    expect(() =>
      validateArgs({ receiver: 'ADDR', amount: 1000 }, schema, 'send_payment')
    ).not.toThrow()
  })

  it('passes valid args with optional fields', () => {
    expect(() =>
      validateArgs(
        { receiver: 'ADDR', amount: 1000, note: 'hello' },
        schema,
        'send_payment'
      )
    ).not.toThrow()
  })

  it('throws on missing required field', () => {
    expect(() =>
      validateArgs({ receiver: 'ADDR' }, schema, 'send_payment')
    ).toThrow("Invalid arguments for send_payment: missing required field 'amount'")
  })

  it('throws on multiple missing required fields', () => {
    expect(() => validateArgs({}, schema, 'send_payment')).toThrow(
      "Invalid arguments for send_payment: missing required field 'receiver'; missing required field 'amount'"
    )
  })

  it('throws on wrong type for a field', () => {
    expect(() =>
      validateArgs({ receiver: 123, amount: 1000 }, schema, 'send_payment')
    ).toThrow("'receiver' expected string, got number")
  })

  it('throws on null required field', () => {
    expect(() =>
      validateArgs({ receiver: 'ADDR', amount: null }, schema, 'send_payment')
    ).toThrow("missing required field 'amount'")
  })

  it('reports both missing and type errors together', () => {
    expect(() =>
      validateArgs({ amount: 'not-a-number' }, schema, 'send_payment')
    ).toThrow(/missing required field 'receiver'.*'amount' expected number, got string/)
  })

  it('ignores extra fields not in schema', () => {
    expect(() =>
      validateArgs(
        { receiver: 'ADDR', amount: 1000, extra: true },
        schema,
        'send_payment'
      )
    ).not.toThrow()
  })

  it('handles schema with no required fields', () => {
    const optionalSchema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
      },
    }
    expect(() => validateArgs({}, optionalSchema, 'tool')).not.toThrow()
  })

  it('handles schema with no properties', () => {
    const bareSchema = { type: 'object' as const }
    expect(() => validateArgs({ anything: 42 }, bareSchema, 'tool')).not.toThrow()
  })

  it('validates integer type as number', () => {
    const intSchema = {
      type: 'object' as const,
      properties: {
        assetId: { type: 'integer' as const, description: 'Asset ID' },
      },
      required: ['assetId'],
    }
    // JS typeof returns 'number' for integers — should pass
    expect(() => validateArgs({ assetId: 42 }, intSchema, 'lookup_asset')).not.toThrow()
  })

  it('validates array type', () => {
    const arraySchema = {
      type: 'object' as const,
      properties: {
        transactions: { type: 'array' as const, description: 'Transaction list' },
      },
      required: ['transactions'],
    }
    expect(() =>
      validateArgs({ transactions: [{ type: 'payment' }] }, arraySchema, 'send_group')
    ).not.toThrow()

    expect(() =>
      validateArgs({ transactions: 'not-an-array' }, arraySchema, 'send_group')
    ).toThrow("'transactions' expected array, got string")
  })

  it('validates boolean type', () => {
    const boolSchema = {
      type: 'object' as const,
      properties: {
        frozen: { type: 'boolean' as const, description: 'Freeze state' },
      },
      required: ['frozen'],
    }
    expect(() =>
      validateArgs({ frozen: true }, boolSchema, 'asset_freeze')
    ).not.toThrow()

    expect(() =>
      validateArgs({ frozen: 'yes' }, boolSchema, 'asset_freeze')
    ).toThrow("'frozen' expected boolean, got string")
  })
})
