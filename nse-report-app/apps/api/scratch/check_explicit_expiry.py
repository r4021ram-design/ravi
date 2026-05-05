from jugaad_data.nse import NSELive
import json

n = NSELive()
n.all_indices() # init session
symbol = "NIFTY"
expiry = "12-May-2026"
url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}&expiryDate={expiry}"
res = n.s.get(url, timeout=10)
data = res.json()
print(f"Records for {expiry}:", len(data["records"]["data"]))
if len(data["records"]["data"]) > 0:
    exp = data["records"]["data"][0].get("expiryDate") or data["records"]["data"][0].get("CE", {}).get("expiryDate")
    print("First record expiry:", exp)
