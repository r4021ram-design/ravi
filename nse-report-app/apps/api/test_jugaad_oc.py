from jugaad_data.nse import NSELive

def test_jugaad_oc():
    try:
        n = NSELive()
        print("Fetching NIFTY Option Chain...")
        oc = n.index_option_chain("NIFTY")
        print("Success! Keys:", oc.keys())
        print("Underlying value:", oc.get("records", {}).get("underlyingValue"))
        
        print("Fetching Market Status...")
        ms = n.market_status()
        print("Status keys:", ms.keys())
        print("Market state:", ms.get("marketState", [])[0] if ms.get("marketState") else "None")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_jugaad_oc()
