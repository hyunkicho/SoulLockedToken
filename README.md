# using zkAA test with snarkjs

1. make r1cs , wasm ,sym

```
cd ./zk/zkaa_register
circom register.circom --r1cs --wasm --sym
```

2. make input
```
npx hardhat test test/zkAAtest.ts
```
and then move input.json to zkaa_register/register_js

3. make input & witness 
```
cd ./register_js
node generate_witness.js register.wasm input.json witness.wtns
```

4. make trusted setup (skip ceremoney in this case)
- We are going to use the Groth16 zk-SNARK protocol. To use this protocol, you will need to generate a trusted setup. Groth16 requires a per circuit trusted setup. In more detail, the trusted setup consists of 2 parts:

1. The powers of tau, which is independent of the circuit.
2. The phase 2, which depends on the circuit.
```
## phase1
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v

## phase2
snarkjs powersoftau prepare phase2 pot14_0000.ptau pot14_final.ptau -v
```

5. make zkey
```
snarkjs groth16 setup register.r1cs pot14_final.ptau poseidon_0000.zkey 
```

6. export zkey
```
snarkjs zkey export verificationkey poseidon_0000.zkey verification_key.json
```

7. generate zk-proof associated to the circuit and the witness

```
cd ./register_js
snarkjs groth16 prove poseidon_0000.zkey ./register_js/witness.wtns proof.json public.json
```

8. generate solidity code that allows verification 

```
snarkjs zkey export solidityverifier poseidon_0000.zkey poseidon_verifier.sol
```

9. generatecall

```
snarkjs generatecall
```

res
```
snarkjs generatecall
["0x10fd57f7ddf2efd557516263a9e8f652819eeb4e3a173ced984cb4e75b42a507", "0x1f16a0e1c9708e18f5bea6851ff0125b35d544be79f177a547e023350cbe5d96"],[["0x17d825cab9b02362257a69d7adbb43d609a3819326ad53970b2d22c515ea82e4", "0x3030fd791daec2d8f2ef6619002fb2be0a9da11c015c942dac23c47f48e4f3ee"],["0x0255597a388742d7a58accbf5d68b2cd7ba7a0e207f32ccf901321cfc92d763a", "0x14cf153d8bb9b7c6ab796ffabc8f1715cdfd6bdbd3866481ee4ed40972ee51aa"]],["0x1e43c0f9a68a021529ec8d8224fdf07cb6ec23b5968d6004fce84317f7805b9e", "0x017d7c20d05223bde59f533f974f10b734f9805c5aec0961c51de7fa185357c0"],["0x1f3f1f6f2b7fcd00622237a74b585c2ea682985762afbda96d4a539f4016e3c0","0x275b0b57d1fcd14732440035ac1f9ca6ade83a83680df180404d91e2a18ac7ba","0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133","0x04548987ccd45e1af10c8eb4c8fd3f4732c80f2c6dd07f8eab48cf33b6aa5163"]
```

