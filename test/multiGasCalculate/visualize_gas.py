import pandas as pd
import matplotlib.pyplot as plt
import json

files = {
    "SLT": "sbt_passkey_parallel_results_small.json",
    "human.tech": "sbt_otterspace_results.json",
    "Binance": "sbt_binance_results.json",
    "Galxe": "sbt_galxe_passport_results.json",
    "zkMe": "sbt_zkme_results.json",
}

# 컬러 + 선 스타일 + 마커 설정
styles = {
    "SLT": {"color": "black", "linestyle": "-", "marker": "o"},
    "human.tech": {"color": "blue", "linestyle": "--", "marker": "s"},
    "Binance": {"color": "darkgreen", "linestyle": "-.", "marker": "D"},
    "Galxe": {"color": "purple", "linestyle": ":", "marker": "^"},
    "zkMe": {"color": "darkorange", "linestyle": "-", "marker": "v"},
}

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

df = pd.DataFrame(records)

plt.figure(figsize=(12, 6))
for system in df["System"].unique():
    subset = df[df["System"] == system]
    style = styles[system]
    plt.plot(
        subset["Iteration"],
        subset["MintGas"],
        label=system,
        color=style["color"],
        linestyle=style["linestyle"],
        marker=style["marker"],
    )

plt.title("Mint Gas Consumption per Iteration")
plt.xlabel("Iteration")
plt.ylabel("Gas Used")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("mint_gas_comparison_with_styles.png", dpi=300)
plt.show()
