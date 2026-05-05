from jugaad_data.nse import NSELive
n = NSELive()
data = n.equities_option_chain("RELIANCE")
print("Number of records in RELIANCE data:", len(data["records"]["data"]))
expiries = set()
for r in data["records"]["data"]:
    exp = r.get("expiryDate") or r.get("CE", {}).get("expiryDate") or r.get("PE", {}).get("expiryDate")
    expiries.add(exp)
print("Expiries found:", sorted(list(expiries)))
