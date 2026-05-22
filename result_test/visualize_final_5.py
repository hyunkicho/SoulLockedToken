import os
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
import json

base_path = os.path.dirname(os.path.abspath(__file__))

system_files = {
    "Binance": "sbt_binance_results.json",
    "Galxe": "sbt_galxe_passport_results.json",
    "human.tech": "sbt_human.tech_results.json",
    "SLT": "sbt_passkey_parallel_results_small.json",
    "zkMe": "sbt_zkme_results.json",
}

records = []
for system, filename in system_files.items():
    full_path = os.path.join(base_path, filename)
    if not os.path.exists(full_path):
        print(f"🚫 {filename} 파일이 없습니다! 경로를 확인해주세요.")
        continue

    with open(full_path, "r") as f:
        data = json.load(f)

    for i, entry in enumerate(data):
        gas = entry.get("gasUsed", {})
        records.append({
            "System": system,
            "Iteration": i,
            "Mint": int(gas.get("mint") or gas.get("setSBT", 0)),
            "Revoke": int(gas.get("revoke") or gas.get("revokeSBT", 0)),
            "Burn": int(gas.get("burn", 0))
        })

df = pd.DataFrame(records)
df_avg = df.groupby("System")[["Mint", "Revoke", "Burn"]].mean()
df_avg_sorted = df_avg.sort_values(by="Mint", ascending=True)

# Plot with wider bars
ax = df_avg_sorted.plot(kind="bar", figsize=(10, 6), colormap='Set2', width=0.85)
plt.ylabel("Average Gas Used", fontsize=12)
plt.xlabel("SBT System", fontsize=12)
plt.xticks(rotation=0)
plt.grid(axis='y', linestyle='--', linewidth=0.5)
plt.legend(title="Function", loc="upper left")

# Y축 천 단위 콤마
ax.yaxis.set_major_formatter(mtick.StrMethodFormatter('{x:,.0f}'))

# Add all labels (Mint, Revoke, Burn) with spacing
for container in ax.containers:
    for bar in container:
        height = bar.get_height()
        if height > 0:
            ax.annotate(f'{height:,.0f}',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 5),  # 높이 조정
                        textcoords="offset points",
                        ha='center', va='bottom',
                        fontsize=9)

# Save
plt.tight_layout()
plt.savefig(os.path.join(base_path, "sbt_5systems_sorted_by_mint.png"), dpi=300)
plt.show()
