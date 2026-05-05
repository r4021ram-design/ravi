from jugaad_data.nse import NSELive
import json

n = NSELive()
data = n.index_option_chain("NIFTY")
print("Keys in data:", data.keys())
print("Keys in records:", data["records"].keys())
print("Number of records in data:", len(data["records"]["data"]))
print("First 3 expiry dates in records:", data["records"]["expiryDates"][:3])
