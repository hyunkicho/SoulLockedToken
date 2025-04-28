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
    "mintGas": int(d["gasUsed"]["mint"]),
    "updateGas": int(d["gasUsed"]["update"]),
    "burnGas": int(d["gasUsed"]["burn"]),
} for d in clean_data])

# 4. 시각화
fig, axs = plt.subplots(2, 1, figsize=(8, 10))

# (1) 서명 및 검증 시간 선 그래프
axs[0].plot(df["tokenId"], df["signTime"], label="Sign Time", color="blue")
axs[0].plot(df["tokenId"], df["verifyTime"], label="Verify Time", color="orange")
axs[0].set_title("Signature & Verification Time by Token ID")
axs[0].set_xlabel("Token ID")
axs[0].set_ylabel("Time (ms)")
axs[0].legend()

# (2) 시간 분포 히스토그램
axs[1].hist(df["signTime"], bins=30, alpha=0.7, label="Sign Time", color="blue")
axs[1].hist(df["verifyTime"], bins=30, alpha=0.7, label="Verify Time", color="orange")
axs[1].set_title("Distribution of Signature and Verification Times")
axs[1].set_xlabel("Time (ms)")
axs[1].set_ylabel("Frequency")
axs[1].legend()

plt.tight_layout()

# 5. 하나의 파일로 저장
plt.savefig("fig_signature_verification_combined.png", dpi=300)

# 6. 따로 저장하고 싶을 때 (추가 코드)
fig1, ax1 = plt.subplots(figsize=(8, 5))
ax1.plot(df["tokenId"], df["signTime"], label="Sign Time", color="blue")
ax1.plot(df["tokenId"], df["verifyTime"], label="Verify Time", color="orange")
ax1.set_title("Signature & Verification Time by Token ID")
ax1.set_xlabel("Token ID")
ax1.set_ylabel("Time (ms)")
ax1.legend()
plt.tight_layout()
plt.savefig("fig_signature_verify_time.png", dpi=300)

fig2, ax2 = plt.subplots(figsize=(8, 5))
ax2.hist(df["signTime"], bins=30, alpha=0.7, label="Sign Time", color="blue")
ax2.hist(df["verifyTime"], bins=30, alpha=0.7, label="Verify Time", color="orange")
ax2.set_title("Distribution of Signature and Verification Times")
ax2.set_xlabel("Time (ms)")
ax2.set_ylabel("Frequency")
ax2.legend()
plt.tight_layout()
plt.savefig("fig_distribution_time.png", dpi=300)
