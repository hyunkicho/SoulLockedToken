import pandas as pd
import matplotlib.pyplot as plt
import json

# JSON 파일 이름 정의
files = {
    "SLT": "sbt_passkey_parallel_results_small.json",
    "OtterSpace": "sbt_otterspace_results.json",
    "Binance": "sbt_binance_results.json",
    "Galxe": "sbt_galxe_passport_results.json",
    "zkMe": "sbt_zkme_results.json",
}

# 고유 색상 지정
colors = {
    "SLT": "blue",
    "OtterSpace": "orange",
    "Binance": "green",
    "Galxe": "purple",
    "zkMe": "red"
}

# 데이터 수집
records = []
for system, path in files.items():
    with open(path, "r") as f:
        data = json.load(f)

    for i, entry in enumerate(data):
        gas_info = entry.get("gasUsed", {})
        mint_gas = gas_info.get("mint") or gas_info.get("setSBT")
        if mint_gas:
            records.append({
                "System": system,
                "Iteration": i,
                "MintGas": int(mint_gas)
            })

# DataFrame 생성
df = pd.DataFrame(records)

# 시각화 시작
plt.figure(figsize=(12, 6))
for system in df["System"].unique():
    subset = df[df["System"] == system]
    plt.plot(
        subset["Iteration"],
        subset["MintGas"],
        label=system,
        marker='o',
        color=colors.get(system, None)  # 기본 색상 없으면 자동 지정
    )

plt.title("Mint Gas Consumption per Iteration")
plt.xlabel("Iteration")
plt.ylabel("Gas Used")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("mint_gas_comparison_linechart_fixed.png", dpi=300)
plt.show()
