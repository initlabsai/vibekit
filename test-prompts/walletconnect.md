# WalletConnect Tools Test Prompt

**MANUAL TEST** - This test requires a mobile wallet (Pera) and user interaction.

Test the WalletConnect connection and signing flow on testnet. Report PASS/FAIL for each test.

## Prerequisites

- Pera Wallet installed on your mobile device
- Pera Wallet configured for TestNet
- TestNet account with some ALGO (get from [TestNet Dispenser](https://bank.testnet.algorand.network/))

## Tools Tested

- connect_walletconnect
- walletconnect_status
- disconnect_walletconnect
- send_payment (with WalletConnect signer)

---

## Phase 1: Network Setup

### Switch to TestNet

1. Use switch_network to switch to "testnet"
   - Verify: network is now testnet
2. Use get_network to confirm
   - Verify: returns testnet configuration

---

## Phase 2: Connection Status (Pre-Connection)

### Check Initial Status

3. Use walletconnect_status
   - Verify: connected = false
   - Verify: hint suggests using connect_walletconnect

---

## Phase 3: Connect Wallet

### Initiate Connection

4. Use connect_walletconnect with wallet "pera"
   - Verify: returns QR code (ASCII and/or image)
   - Verify: returns instructions for connecting

### Manual Step: Scan QR Code

5. **USER ACTION REQUIRED:**
   - Open Pera Wallet on your mobile device
   - Ensure you're on TestNet (Settings > Node Settings > TestNet)
   - Tap the scan/connect button
   - Scan the QR code displayed
   - Approve the connection request in Pera

### Verify Connection

6. Use walletconnect_status
   - Verify: connected = true
   - Verify: wallet = "Pera Wallet"
   - Verify: accounts array contains your wallet address(es)
   - Verify: network = "testnet"

7. Use list_accounts
   - Verify: wallet accounts appear with provider "walletconnect"

8. Use get_active_account
   - Verify: returns the connected wallet account

---

## Phase 4: Transaction Signing

### Get Account Info

9. Use get_account_info for the connected wallet account
    - Verify: shows balance (should have some TestNet ALGO)
    - Note the current balance

### Send Payment (Requires Mobile Approval)

10. **USER ACTION REQUIRED:**
    Use send_payment to send 0.1 ALGO to this address:
    `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ`
    (This is the zero address - funds are effectively burned on testnet)

    - Verify: Pera Wallet shows signing request on mobile
    - **Approve the transaction in Pera Wallet**
    - Verify: returns transaction ID

11. Use get_account_info for the connected wallet account
    - Verify: balance decreased by ~0.1 ALGO + fee (0.001 ALGO)

---

## Phase 5: Reconnection (Session Persistence)

### Verify Session Saved

12. Use walletconnect_status
    - Verify: still connected (session persisted)

13. Use connect_walletconnect again
    - Verify: returns "Already connected" message
    - Verify: does NOT show new QR code

---

## Phase 6: Disconnect

### Disconnect Wallet

14. Use disconnect_walletconnect
    - Verify: success = true
    - Verify: message confirms disconnection

### Verify Disconnected

15. Use walletconnect_status
    - Verify: connected = false

16. Use list_accounts
    - Verify: wallet accounts no longer appear (or marked as disconnected)

---

## Phase 7: Reconnect (Optional)

### Test Fresh Connection After Disconnect

17. Use connect_walletconnect
    - Verify: shows new QR code (fresh pairing)
    - **Scan and approve if you want to reconnect**

---

## Error Cases

### LocalNet Restriction

18. Use switch_network to switch to "localnet"
19. Use walletconnect_status
    - Verify: returns error about wallet not available on localnet
20. Use connect_walletconnect
    - Verify: returns error about localnet not supported

---

## Summary

| Tool                    | Test Steps | Requires User Action |
| ----------------------- | ---------- | -------------------- |
| connect_walletconnect   | 4, 13, 17  | Yes (QR scan)        |
| walletconnect_status    | 3, 6, 12, 15, 19 | No            |
| disconnect_walletconnect| 14         | No                   |
| send_payment (via WC)   | 10         | Yes (mobile approve) |

**Total: 20 test steps, 3 require mobile wallet interaction**

---

## Troubleshooting

- **QR code not scanning:** Ensure Pera is on TestNet, not MainNet
- **Connection timeout:** Try disconnect_walletconnect and reconnect
- **Transaction rejected:** Check you have sufficient TestNet ALGO
- **Session not persisting:** Check ~/.vibekit/vibekit.db exists
