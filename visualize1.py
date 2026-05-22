import pandas as pd
import matplotlib.pyplot as plt
import json

# 1. JSON 파일 불러오기
with open("sbt_passkey_parallel_results_small.json", "r") as f:
    data = json.load(f)

# 2. 실패한 테스트 제거
clean_data = [d for d in data if not d.get("error", False)]

# 3. DataFrame으로 변환
df = pd.DataFrame([{
    "tokenId": d["tokenId"],
    "signTime": d["time"]["sign"],
    "verifyTime": d["time"]["verify"],
    "ownerOfTime": d["time"]["ownerOf"],
} for d in clean_data])

# 4. 시각화 시작
fig, axs = plt.subplots(2, 2, figsize=(12, 8))

# (1) 시간 선 그래프
axs[0, 0].plot(df["tokenId"], df["signTime"], label="Sign Time")
axs[0, 0].plot(df["tokenId"], df["verifyTime"], label="Verify Time")
axs[0, 0].plot(df["tokenId"], df["ownerOfTime"], label="OwnerOf Time")
axs[0, 0].set_title("Signature & Verification Time by Token ID")
axs[0, 0].set_xlabel("Token ID")
axs[0, 0].set_ylabel("Time (ms)")
axs[0, 0].legend()
plt.tight_layout()
plt.savefig("fig_signature_verify_time.png", dpi=300)  # 🔥 저장!

plt.figure(figsize=(6, 4))
plt.plot(df["tokenId"], df["signTime"], label="Sign Time")
plt.plot(df["tokenId"], df["verifyTime"], label="Verify Time")
plt.plot(df["tokenId"], df["ownerOf"], label="OwnerOf Time")
plt.title("Signature & Verification Time by Token ID")
plt.xlabel("Token ID")
plt.ylabel("Time (ms)")
plt.legend()
plt.tight_layout()
plt.savefig("fig_signature_verify_time.png", dpi=300)  # 🔥 저장!
plt.close()
