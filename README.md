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
npx hardhat test test/SoulLockedTokenMulti.ts
```

5. visualization
```
brew install python
python3 -m venv venv
source venv/bin/activate
pip install pandas matplotlib
python visualize.py 
```
