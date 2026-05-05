from jugaad_data.nse import NSELive
import json

n = NSELive()
# Test calling option_chain_v3 without expiry
data = n.get("option_chain_v3", {"type": "Indices", "symbol": "NIFTY"})
print("Records in records['data'] (no expiry):", len(data.get("records", {}).get("data", [])))
expiries = set()
for r in data.get("records", {}).get("data", []):
    exp = r.get("expiryDate") or r.get("CE", {}).get("expiryDate")
    if exp: expiries.add(exp)
print("Expiries found:", sorted(list(expiries)))
