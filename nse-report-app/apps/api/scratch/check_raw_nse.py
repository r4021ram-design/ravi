from jugaad_data.nse import NSELive
import json

n = NSELive()
n.all_indices() # init session
url = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY"
res = n.s.get(url, timeout=10)
data = res.json()
print("Number of records in records['data']:", len(data["records"]["data"]))
expiries = set()
for r in data["records"]["data"]:
    exp = r.get("expiryDate")
    if exp:
        expiries.add(exp)
print("Expiries in records['data']:", sorted(list(expiries)))
