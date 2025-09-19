import os
import pandas as pd
import matplotlib.pyplot as plt
import json

# 현재 디렉토리 기준 파일 경로
base_path = os.path.dirname(os.path.abspath(__file__))

system_files = {
    "Binance": "sbt_binance_results.json",
    "Galxe": "sbt_galxe_passport_results.json",
    "OtterSpace": "sbt_otterspace_results.json",
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

# 데이터프레임 생성 및 평균 계산
df = pd.DataFrame(records)
df_avg = df.groupby("System")[["Mint", "Revoke", "Burn"]].mean()

# Mint 기준 오름차순 정렬
df_avg_sorted = df_avg.sort_values(by="Mint", ascending=True)

# 막대 차트 시각화
df_avg_sorted.plot(kind="bar", figsize=(10, 6), colormap='Set2')
plt.title("Average Gas Usage per SBT System (Sorted by Mint)")
plt.ylabel("Average Gas Used")
plt.xlabel("SBT System")
plt.grid(axis='y')
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig(os.path.join(base_path, "sbt_5systems_sorted_by_mint.png"), dpi=300)
plt.show()
