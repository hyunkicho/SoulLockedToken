import pandas as pd
import matplotlib.pyplot as plt
import json

# 1. JSON 파일 불러오기
with open("sbt_passkey_sequential_results.json", "r") as f:
    data = json.load(f)

# 2. 실패한 테스트 제거
clean_data = [d for d in data if not d.get("error", False)]

# 3. DataFrame으로 변환
df = pd.DataFrame([{
    "tokenId": d["tokenId"],
    "signTime": d["time"]["sign"],
    "verifyTime": d["time"]["verify"],
    "mintGas": (d["gasUsed"]["mint"]),
    "updateGas": (d["gasUsed"]["update"]),
    "burnGas": (d["gasUsed"]["burn"]),
} for d in clean_data])

# 4. 시각화 시작
fig, axs = plt.subplots(2, 2, figsize=(12, 8))

# (1) 시간 선 그래프
axs[0, 0].plot(df["tokenId"], df["signTime"], label="Sign Time")
axs[0, 0].plot(df["tokenId"], df["verifyTime"], label="Verify Time")
axs[0, 0].set_title("Signature & Verification Time by Token ID")
axs[0, 0].set_xlabel("Token ID")
axs[0, 0].set_ylabel("Time (ms)")
axs[0, 0].legend()
plt.tight_layout()
plt.savefig("fig_signature_verify_time.png", dpi=300)  # 🔥 저장!

# (2) 가스 선 그래프
axs[0, 1].plot(df["tokenId"], df["mintGas"], label="Mint Gas")
axs[0, 1].plot(df["tokenId"], df["updateGas"], label="UpdateAuth Gas")
axs[0, 1].plot(df["tokenId"], df["burnGas"], label="Burn Gas")
axs[0, 1].set_title("Gas Usage by Token ID")
axs[0, 1].set_xlabel("Token ID")
axs[0, 1].set_ylabel("Gas")
axs[0, 1].legend()


# (3) 시간 분포 히스토그램
axs[1, 0].hist(df["signTime"], bins=30, alpha=0.7, label="Sign Time")
axs[1, 0].hist(df["verifyTime"], bins=30, alpha=0.7, label="Verify Time")
axs[1, 0].set_title("Distribution of Time")
axs[1, 0].set_xlabel("Time (ms)")
axs[1, 0].set_ylabel("Frequency")
axs[1, 0].legend()

# (4) Update 가스 분포 히스토그램
axs[1, 1].hist(df["updateGas"], bins=30, alpha=0.7, label="UpdateAuth Gas", color="purple")
axs[1, 1].set_title("Distribution of UpdateAuth Gas")
axs[1, 1].set_xlabel("Gas")
axs[1, 1].set_ylabel("Frequency")
axs[1, 1].legend()

plt.tight_layout()
plt.show()
