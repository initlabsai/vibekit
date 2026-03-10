/** Formatted application returned by handlers. */
export interface FormattedApplication {
  applicationId: number
  creator?: string
  globalState?: Array<{
    key: string
    value: {
      type: number
      bytes?: string
      uint?: number
    }
  }>
  localStateSchema?: { numByteSlice: number; numUint: number }
  globalStateSchema?: { numByteSlice: number; numUint: number }
}
