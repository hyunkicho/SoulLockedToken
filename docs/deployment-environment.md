# Vercel Deployment Environment

## Purpose

This deployment provides a browser-accessible experiment surface for SoulLockedToken passkey verification. A test user can open the hosted Vercel app, connect MetaMask, deploy a fresh Base Sepolia contract from the browser, register a platform passkey, mint an SBT, update authentication status on-chain, and run a read-only verification.

## Network

- Chain: Base Sepolia
- Chain ID: `84532` / `0x14a34`
- RPC used by wallet: `https://sepolia.base.org`
- Explorer: `https://sepolia.basescan.org`
- P-256 verifier: RIP-7212 precompile at `0x0000000000000000000000000000000000000100`

## Hosting

- Frontend host: Vercel static deployment
- Build root: repository root
- Build app: `front-end/passkey-minter`
- Install command: `npm install --prefix front-end/passkey-minter`
- Build command: `npm run build --prefix front-end/passkey-minter`
- Output directory: `front-end/passkey-minter/build`

## User-Controlled Contract Deployment

The app deploys `SoulLockedTokenNew` directly from the connected MetaMask account. This makes the connected account the contract owner and default `WEB2AUTH_ROLE` holder, so the same user can perform:

- `safeMint`
- `passKeyChecker`
- `updateAuth`
- `authCheck`

The frontend patches the compiled artifact bytecode before deployment, replacing the local Hardhat P-256 verifier address with the Base Sepolia RIP-7212 precompile address. The deployed contract address is saved in browser `localStorage` under `soulLockedToken.contractAddress.baseSepolia` so the same browser session can continue testing without redeploying.

## Test Procedure

1. Open the Vercel URL in a browser with platform passkey support.
2. Connect MetaMask to Base Sepolia.
3. Fund the connected wallet with Base Sepolia ETH.
4. Click `DEPLOY NEW CONTRACT`.
5. Wait for the deployment transaction to confirm.
6. Click `EXECUTE FULL TEST`.
7. Complete the platform passkey registration and authentication prompts.
8. Confirm the MetaMask `safeMint` and `updateAuth` transactions.
9. Confirm that `PASSKEY STATUS` is `VERIFIED`.
10. Click `RUN VERIFY READ` to test read-only passkey verification.

## Security Notes

- No owner private key is committed to git.
- No owner private key is embedded in the browser bundle.
- The user wallet is the deployer and contract owner.
- Vercel does not need a private relayer key for this flow.
- The deployed contract is for Base Sepolia research/demo use, not production custody.

## Paper-Ready Deployment Description

The experiment was hosted as a Vercel static web application connected to Base Sepolia. Test participants used MetaMask to deploy a fresh `SoulLockedTokenNew` instance from the web interface, making the participant wallet the contract owner. The application then used the browser WebAuthn API to create a platform passkey, extracted the P-256 public key from the attestation object, minted a soulbound token with the credential public key, requested a WebAuthn assertion, normalized the P-256 signature to low-S form, and verified it on-chain through the Base Sepolia RIP-7212 precompile. Authentication state was updated through `updateAuth`, and the final state was queried through `authCheck` and a read-only `passKeyChecker` call.
