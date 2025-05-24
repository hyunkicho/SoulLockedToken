# Soul Locked Token
Soul locked Token is a paper currently in preparation for publication, and this repository is a link to an experiment in the paper.

# Testing SLT and Attack
1. install
```
npm install
```

2. test Soul Locked Token
```
npx hardhat test test/SoulLockedToken.ts
```

3. test Attack via Account Abstraction
```
npx hardhat test test/AttackWithAA.ts
```

4. Multiple Test
```aiignore
npx hardhat test test/SoulLockedTokenMulti.ts //SLT
npx hardhat test test/BinanceSBT.ts //BAT
npx hardhat test test/GalxeSBT.ts //GlaxePassport
npx hardhat test test/otterspace.ts //otterspace
npx hardhat test test/zkMe.ts //zkme SBT
```

5. visualization
```
brew install python
python3 -m venv venv
source venv/bin/activate
pip install pandas matplotlib
python visualize.py 
```

6. source code.

GlaxePassport code source
```
https://dashboard.tenderly.co/contract/bnb/0xe84050261cb0a35982ea0f6f3d9dff4b8ed3c012/code
```

OtterSpace source code
```
https://optimistic.etherscan.io/token/0x2aa822e264f8cc31a2b9c22f39e5551241e94dfb#code
```

zkme source code
```
https://polygonscan.com/address/0x333e79aeaa286644d2b2e700c330e364ccbb631a#code
```

BABT source code
```
https://bscscan.com/token/0x2b09d47d550061f995a3b5c6f0fd58005215d7c8?a=0x2f1FbD2Ac7a01E4fC6e207EeAac0C875A464dC7D
```

