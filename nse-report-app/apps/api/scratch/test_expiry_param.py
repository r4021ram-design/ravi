from jugaad_data.nse import NSELive
n = NSELive()
try:
    data = n.index_option_chain("NIFTY", expiryDate="12-May-2026")
    print("Fetched for 12-May-2026. Records:", len(data["records"]["data"]))
    exp = data["records"]["data"][0].get("expiryDate") or data["records"]["data"][0].get("CE", {}).get("expiryDate")
    print("First record expiry:", exp)
except Exception as e:
    print("Error:", e)
