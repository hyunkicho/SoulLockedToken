import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextDecoder, TextEncoder } from 'util';

const mockSafeMint = jest.fn();
const mockUpdateAuth = jest.fn();
const mockAuthCheck = jest.fn();
const mockPassKeyChecker = jest.fn();
const mockBuildSignatureStaticCall = jest.fn();
const mockGetAddress = jest.fn();
const mockOwner = jest.fn();

jest.mock('cbor', () => ({
  decode: jest.fn(),
}));

jest.mock('ethers', () => ({
  BrowserProvider: class {
    send = jest.fn().mockResolvedValue([]);
    getSigner = jest.fn().mockResolvedValue({
      getAddress: mockGetAddress,
    });
  },
  Contract: class {
    safeMint = mockSafeMint;
    updateAuth = mockUpdateAuth;
    authCheck = mockAuthCheck;
    passKeyChecker = mockPassKeyChecker;
    owner = mockOwner;
    buildSignature = {
      staticCall: mockBuildSignatureStaticCall,
    };
  },
  AbiCoder: {
    defaultAbiCoder: jest.fn(() => ({
      encode: jest.fn(() => `0x${'ab'.repeat(32)}`),
    })),
  },
  solidityPacked: jest.fn(() => `0x01${'00'.repeat(6)}${'11'.repeat(32)}`),
  ethers: {
    AbiCoder: {
      defaultAbiCoder: jest.fn(() => ({
        encode: jest.fn(() => `0x${'ab'.repeat(32)}`),
      })),
    },
    hexlify: jest.fn((value) => {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    }),
    solidityPacked: jest.fn(() => `0x01${'00'.repeat(6)}${'11'.repeat(32)}`),
  },
}));

const { decode } = require('cbor');
const { AbiCoder, solidityPacked } = require('ethers');
process.env.REACT_APP_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000001';
const PasskeyFullTest = require('./passkeyFullTest').default;

const toArrayBuffer = (bytes) => Uint8Array.from(bytes).buffer;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const makeAuthData = () => {
  const authData = new Uint8Array(60);
  authData[32] = 0x05;
  authData[53] = 0x00;
  authData[54] = 0x00;
  return authData;
};

const makeDerSignature = () => {
  const r = new Array(32).fill(1);
  const s = new Array(32).fill(2);
  return toArrayBuffer([0x30, 0x44, 0x02, 0x20, ...r, 0x02, 0x20, ...s]);
};

const P256_N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

const bigIntToFixedBytes = (value, length = 32) => {
  const hex = value.toString(16).padStart(length * 2, '0');
  return hex.match(/.{2}/g).map((byte) => parseInt(byte, 16));
};

const makeHighSDerSignature = () => {
  const r = new Array(32).fill(1);
  const highS = bigIntToFixedBytes(P256_N - 2n);
  return toArrayBuffer([0x30, 0x45, 0x02, 0x20, ...r, 0x02, 0x21, 0x00, ...highS]);
};

describe('PasskeyFullTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAddress.mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    mockOwner.mockResolvedValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    mockSafeMint.mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) });
    mockUpdateAuth.mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) });
    mockPassKeyChecker.mockResolvedValue(true);
    mockAuthCheck
      .mockResolvedValueOnce({ checked: true, checkedAt: 100n })
      .mockResolvedValueOnce({ checked: true, checkedAt: 101n })
      .mockResolvedValue({ checked: true, checkedAt: 101n });
    mockBuildSignatureStaticCall.mockRejectedValue(new Error('old contract ABI'));
    AbiCoder.defaultAbiCoder.mockReturnValue({
      encode: jest.fn(() => `0x${'ab'.repeat(32)}`),
    });
    solidityPacked.mockReturnValue(`0x01${'00'.repeat(6)}${'11'.repeat(32)}`);

    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        request: jest.fn(({ method }) => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
            return Promise.resolve(['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']);
          }

          if (method === 'eth_chainId') {
            return Promise.resolve('0x14a34');
          }

          return Promise.resolve(null);
        }),
      },
    });
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (array) => {
          array.fill(7);
          return array;
        },
      },
    });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: jest.fn().mockResolvedValue({
          rawId: toArrayBuffer([1, 2, 3, 4]),
          response: {
            attestationObject: toArrayBuffer([9, 9, 9]),
          },
        }),
        get: jest.fn().mockResolvedValue({
          rawId: toArrayBuffer([1, 2, 3, 4]),
          response: {
            signature: makeDerSignature(),
            authenticatorData: toArrayBuffer([0, 1, 2, 3, 4]),
            clientDataJSON: new TextEncoder().encode(
              '{"type":"webauthn.get","challenge":"AQAAAAAAERERERERERERERERERERERERERERERERERERERERERE","origin":"http://localhost:3000","crossOrigin":false}'
            ).buffer,
          },
        }),
      },
    });

    const pubKeyX = toArrayBuffer(new Array(32).fill(3));
    const pubKeyY = toArrayBuffer(new Array(32).fill(4));
    decode
      .mockReturnValueOnce({ authData: makeAuthData() })
      .mockReturnValueOnce(new Map([[-2, pubKeyX], [-3, pubKeyY]]));
  });

  it('sends updateAuth after passkey assertion', async () => {
    render(<PasskeyFullTest />);

    fireEvent.click(screen.getByRole('button', { name: /execute full test/i }));

    await waitFor(() => expect(mockUpdateAuth).toHaveBeenCalledTimes(1));
    expect(mockAuthCheck).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Auth update transaction confirmed/i)).toBeInTheDocument();
  });

  it('runs passKeyChecker as a read-only verify action', async () => {
    render(<PasskeyFullTest />);

    fireEvent.click(screen.getByRole('button', { name: /execute full test/i }));
    await waitFor(() => expect(mockUpdateAuth).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /run verify read/i }));

    await waitFor(() => expect(mockPassKeyChecker).toHaveBeenCalledTimes(2));
    expect(mockUpdateAuth).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Read-only verify result: VALID/i)).toBeInTheDocument();
  });

  it('normalizes high-S browser passkey signatures before on-chain verification', async () => {
    mockBuildSignatureStaticCall.mockResolvedValue(true);
    navigator.credentials.get.mockResolvedValue({
      rawId: toArrayBuffer([1, 2, 3, 4]),
      response: {
        signature: makeHighSDerSignature(),
        authenticatorData: toArrayBuffer([0, 1, 2, 3, 4]),
        clientDataJSON: new TextEncoder().encode(
          '{"type":"webauthn.get","challenge":"BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc","origin":"http://localhost:3000","crossOrigin":false}'
        ).buffer,
      },
    });

    render(<PasskeyFullTest />);

    fireEvent.click(screen.getByRole('button', { name: /execute full test/i }));

    await waitFor(() => expect(mockPassKeyChecker).toHaveBeenCalled());
    expect(mockPassKeyChecker.mock.calls[0][0].s).toBe(`0x${'0'.repeat(63)}2`);
  });
});
