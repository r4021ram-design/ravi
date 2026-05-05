from jugaad_data.nse import NSELive
import json

n = NSELive()
data = n.index_option_chain("NIFTY")
print(json.dumps(data["records"]["data"][0], indent=2))
print("---")
print(json.dumps(data["records"]["expiryDates"][:3], indent=2))
