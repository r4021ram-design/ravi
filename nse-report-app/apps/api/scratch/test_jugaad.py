from jugaad_data.nse import index_df
from datetime import date, timedelta

try:
    end = date.today()
    start = end - timedelta(days=30)
    print(f"Fetching NIFTY 50 from {start} to {end}")
    df = index_df(symbol="NIFTY 50", from_date=start, to_date=end)
    print("DF Empty?", df.empty)
    print("Columns:", df.columns)
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
