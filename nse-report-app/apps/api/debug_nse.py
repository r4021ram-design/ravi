from jugaad_data.nse import NSELive
import json

n = NSELive()
try:
    data = n.index_option_chain("NIFTY")
    print("Underlying:", data.get("records", {}).get("underlyingValue"))
    print("Expiries count:", len(data.get("records", {}).get("expiryDates", [])))
    print("Strikes count:", len(data.get("records", {}).get("data", [])))
    if len(data.get("records", {}).get("data", [])) > 0:
        print("First record keys:", data.get("records", {}).get("data", [])[0].keys())
        print("First record expiry:", data.get("records", {}).get("data", [])[0].get("expiryDate"))
except Exception as e:
    print("Error:", e)
