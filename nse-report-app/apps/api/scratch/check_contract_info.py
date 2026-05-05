from jugaad_data.nse import NSELive
n = NSELive()
info = n.option_chain_contract_info("NIFTY")
print(info.get("expiryDates")[:3])
