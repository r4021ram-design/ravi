from jugaad_data.nse import NSELive

def test_jugaad():
    try:
        n = NSELive()
        print("Fetching all indices...")
        q = n.all_indices()
        print("Success! Keys:", q.keys())
        for idx in q.get("data", []):
            if idx.get("index") == "NIFTY 50":
                print(f"NIFTY 50: {idx.get('last')}")
        
        print("\nFetching NIFTY Option Chain...")
        oc = n.option_chain("NIFTY")
        print("Success! Option Chain keys:", oc.keys())
        print("Underlying value:", oc.get("records", {}).get("underlyingValue"))
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_jugaad()
