from jugaad_data.nse import NSELive
from collections import Counter

n = NSELive()
data = n.index_option_chain("NIFTY")
expiries = []
for r in data["records"]["data"]:
    exp = r.get("expiryDate") or r.get("CE", {}).get("expiryDate") or r.get("PE", {}).get("expiryDate")
    expiries.append(exp)

print(Counter(expiries))
