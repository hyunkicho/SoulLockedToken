const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getBytes,
  hexlify,
  toBeHex,
} = require('../front-end/passkey-minter/node_modules/ethers');

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const LOCAL_P256_VERIFIER = '5fbdb2315678afecb367f032d93f642f64180aa3';
const RIP_7212_PRECOMPILE = '0000000000000000000000000000000000000100';
const CURVE_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

function readEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return env;
}

function patchP256Verifier(bytecode) {
  const occurrences = bytecode.toLowerCase().split(LOCAL_P256_VERIFIER).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one local P256 verifier address in bytecode, found ${occurrences}.`);
  }
  return bytecode.replace(new RegExp(LOCAL_P256_VERIFIER, 'i'), RIP_7212_PRECOMPILE);
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function derToRS(der) {
  const bytes = Buffer.from(der);
  if (bytes[0] !== 0x30) throw new Error('Signature is not DER encoded.');
  let offset = 2;

  const readInt = () => {
    if (bytes[offset] !== 0x02) throw new Error('Invalid DER integer.');
    const length = bytes[offset + 1];
    offset += 2;
    let value = bytes.subarray(offset, offset + length);
    offset += length;
    while (value.length > 0 && value[0] === 0) value = value.subarray(1);
    return BigInt(`0x${value.toString('hex') || '0'}`);
  };

  const r = readInt();
  let s = readInt();
  if (s > CURVE_N / 2n) s = CURVE_N - s;

  return [toBeHex(r, 32), toBeHex(s, 32)];
}

function createSmokeCredential(challenge) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = hexlify(Buffer.from(jwk.x, 'base64url'));
  const y = hexlify(Buffer.from(jwk.y, 'base64url'));
  const authenticatorData = Buffer.alloc(37);
  authenticatorData[32] = 0x05;
  const clientDataJSON = JSON.stringify({
    type: 'webauthn.get',
    challenge: base64Url(getBytes(challenge)),
    origin: 'http://localhost:3000',
    crossOrigin: false,
  });
  const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
  const signedPayload = Buffer.concat([authenticatorData, clientDataHash]);
  const signature = crypto.sign('SHA256', signedPayload, privateKey);
  const [r, s] = derToRS(signature);
  const credId = hexlify(crypto.randomBytes(32));

  return {
    credId,
    publicKeyCoordinates: [x, y],
    signature: {
      authenticatorData: hexlify(authenticatorData),
      clientDataJSON,
      challengeLocation: clientDataJSON.indexOf('"challenge":"'),
      responseTypeLocation: clientDataJSON.indexOf('"type":"webauthn.get"'),
      r,
      s,
      credId,
    },
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPassKeyChecker(contract, signature, challenge, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const isValid = await contract.passKeyChecker(signature, challenge);
    if (isValid) return true;
    if (attempt < attempts - 1) await sleep(1000);
  }
  return false;
}

async function main() {
  const env = readEnv();
  if (!env.PRIVATE_KEY) throw new Error('PRIVATE_KEY is missing in .env');
  if (!env.BASE_SEPOLIA_RPC_URL) throw new Error('BASE_SEPOLIA_RPC_URL is missing in .env');

  const artifactPath = path.join(__dirname, '..', 'front-end', 'passkey-minter', 'src', 'SoulLockedTokenNew.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const bytecode = patchP256Verifier(artifact.bytecode);
  const provider = new JsonRpcProvider(env.BASE_SEPOLIA_RPC_URL);
  const wallet = new Wallet(env.PRIVATE_KEY, provider);
  const network = await provider.getNetwork();
  if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Wrong network: expected ${BASE_SEPOLIA_CHAIN_ID}, got ${network.chainId}`);
  }

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);

  const factory = new ContractFactory(artifact.abi, bytecode, wallet);
  const existingAddress = process.argv[2];
  const contract = existingAddress
    ? factory.attach(existingAddress)
    : await factory.deploy('SoulLockedToken', 'SLT', true);

  if (!existingAddress) {
    console.log(`Deploy tx: ${contract.deploymentTransaction().hash}`);
    await contract.waitForDeployment();
  }

  const contractAddress = await contract.getAddress();
  console.log(`SoulLockedTokenNew: ${contractAddress}`);

  const owner = await contract.owner();
  console.log(`Owner: ${owner}`);

  const tokenId = Date.now();
  const challenge = hexlify(crypto.randomBytes(32));
  const smoke = createSmokeCredential(challenge);
  const mintTx = await contract.safeMint(wallet.address, tokenId, smoke.credId, smoke.publicKeyCoordinates);
  console.log(`safeMint tx: ${mintTx.hash}`);
  await mintTx.wait();

  const isValid = await waitForPassKeyChecker(contract, smoke.signature, challenge);
  console.log(`passKeyChecker: ${isValid}`);
  if (!isValid) throw new Error('Smoke signature did not verify on-chain.');

  const updateTx = await contract.updateAuth(smoke.signature, challenge, tokenId, smoke.credId, {
    gasLimit: 1000000,
  });
  console.log(`updateAuth tx: ${updateTx.hash}`);
  await updateTx.wait();
  const authInfo = await contract.authCheck(tokenId, wallet.address);
  console.log(`authCheck.checked: ${authInfo.checked}`);
  console.log(`authCheck.checkedAt: ${authInfo.checkedAt.toString()}`);

  const frontendEnvPath = path.join(__dirname, '..', 'front-end', 'passkey-minter', '.env');
  fs.writeFileSync(frontendEnvPath, [
    `REACT_APP_CONTRACT_ADDRESS=${contractAddress}`,
    'REACT_APP_DEFAULT_NETWORK=baseSepolia',
    'REACT_APP_CHAIN_ID=0x14a34',
    'REACT_APP_CHAIN_NAME=Base Sepolia',
    `REACT_APP_RPC_URL=${env.BASE_SEPOLIA_RPC_URL}`,
    'REACT_APP_BLOCK_EXPLORER_URL=https://sepolia.basescan.org',
    '',
  ].join('\n'));
  console.log(`Updated ${path.relative(path.join(__dirname, '..'), frontendEnvPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
