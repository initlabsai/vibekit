# Transactions Tools Test Prompt

Test the MCP atomic transaction tools on localnet. Report PASS/FAIL for each test.

**Prerequisites:**

- Two funded accounts (USER1, USER2) must exist
- An asset created by USER1, with USER2 opted in

## Tools Tested

- send_atomic_group

## Setup

1. Ensure USER1 and USER2 exist and are funded with at least 10 ALGO each
2. Create a test asset "AtomicToken" (ATOM) with USER1 as creator
3. Have USER2 opt into the asset
4. Transfer some tokens to USER2

## Atomic Group Tests

### Basic Atomic Group (Multiple Payments)

5. Use send_atomic_group to send two payments atomically:

   ```json
   {
     "transactions": [
       {
         "type": "pay",
         "sender": "USER1",
         "receiver": "USER2",
         "amount": 100000
       },
       {
         "type": "pay",
         "sender": "USER2",
         "receiver": "USER1",
         "amount": 50000
       }
     ]
   }
   ```

   - Verify: returns group transaction ID
   - Verify: both transactions succeeded atomically

6. Use get_account_info for both accounts
   - Verify: balances reflect both transfers

### Atomic Asset Transfer

7. Use send_atomic_group with payment + asset transfer:

   ```json
   {
     "transactions": [
       {
         "type": "pay",
         "sender": "USER1",
         "receiver": "USER2",
         "amount": 100000
       },
       {
         "type": "axfer",
         "sender": "USER1",
         "receiver": "USER2",
         "assetId": <asset_id>,
         "amount": 100
       }
     ]
   }
   ```

   - Verify: returns group transaction ID
   - Verify: both payment and asset transfer succeeded

### Atomic Swap Pattern

8. Use send_atomic_group for an atomic swap (USER1 sends ALGO, USER2 sends tokens):

   ```json
   {
     "transactions": [
       {
         "type": "pay",
         "sender": "USER1",
         "receiver": "USER2",
         "amount": 1000000
       },
       {
         "type": "axfer",
         "sender": "USER2",
         "receiver": "USER1",
         "assetId": <asset_id>,
         "amount": 50
       }
     ]
   }
   ```

   - Verify: both transactions in the swap succeeded atomically

### App Call in Atomic Group

9. Deploy a simple app (if not already deployed)

10. Use send_atomic_group with payment + app call:

    ```json
    {
      "transactions": [
        {
          "type": "pay",
          "sender": "USER1",
          "receiver": "<app_address>",
          "amount": 100000
        },
        {
          "type": "appl",
          "sender": "USER1",
          "appId": <app_id>,
          "appArgs": ["method_selector", "arg1"]
        }
      ]
    }
    ```

    - Verify: payment and app call both succeeded

### Error Handling

11. Attempt send_atomic_group where one transaction would fail:
    - e.g., second transaction sends more than available balance
    - Verify: entire group fails atomically
    - Verify: no partial execution occurred

## Cleanup

12. Destroy the test asset
13. Delete any test apps

## Summary

| Tool              | Test Steps      |
| ----------------- | --------------- |
| send_atomic_group | 5, 7, 8, 10, 11 |
