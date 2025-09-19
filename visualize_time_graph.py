import json
import pandas as pd
import matplotlib.pyplot as plt

# 1. JSON 파일 로드
with open("sbt_passkey_serial_results.json", "r") as f:
    raw_data = json.load(f)

# 2. 유효한 결과만 추출
data = [entry for entry in raw_data if not entry.get("error", False)]

# 3. DataFrame으로 변환
df = pd.DataFrame([{
    "tokenId": entry["tokenId"],
    "signTime": entry["time"]["sign"],
    "verifyTime": entry["time"]["verify"],
    # "callTime": entry["time"]["ownerCall"],
} for entry in data])

# 4. 선 그래프 출력
plt.figure(figsize=(12, 6))
plt.plot(df["tokenId"], df["signTime"], label="Sign Time", color="blue", linewidth=0.8)
plt.plot(df["tokenId"], df["verifyTime"], label="Verify Time", color="orange", linewidth=0.8)
# plt.plot(df["tokenId"], df["callTime"], label="Call Time", color="green", linewidth=0.8)

plt.xlabel("Token ID")
plt.ylabel("Time (ms)")
plt.legend()
plt.grid(True, linestyle="--", alpha=0.5)
plt.tight_layout()
plt.savefig("slt_signature_timing_chart.png", dpi=300)
plt.show()
