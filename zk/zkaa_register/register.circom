pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";

template Circuit() {
    signal input A[2]; // public key
    signal input R[2]; // sig
    signal input S; // sig
    signal input Rand;
    signal input M; // msg to create S
    signal input h_cert;
    // signal output out;

    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.Ax <== A[0];
    eddsa.Ay <== A[1];
    eddsa.R8x <== R[0];
    eddsa.R8y <== R[1];
    eddsa.S <== S;
    eddsa.M <== M;

    component poseidon = Poseidon(4);
    poseidon.inputs[0] <== Rand;
    poseidon.inputs[1] <== R[0];
    poseidon.inputs[2] <== R[1];
    poseidon.inputs[3] <== S;

    h_cert === poseidon.out;
}

// component main {public [A, h_cert]} = Circuit();
component main {public [A, M, h_cert]} = Circuit();
