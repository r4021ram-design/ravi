import yfinance as yf
from datetime import date, timedelta
import pandas as pd

ticker = "^NSEI"
days = 90
end = date.today()
start = end - timedelta(days=days)
print(f"Downloading {ticker} from {start} to {end}")

df = yf.download(ticker, start=start, end=end, progress=False)
print("DF Empty?", df.empty)
print("Columns:", df.columns)
print("Head:\n", df.head())

# Test the flattening logic
if isinstance(df.columns, pd.MultiIndex):
    print("MultiIndex detected")
    df.columns = df.columns.get_level_values(0)
    print("Flattened columns:", df.columns)

for idx, row in df.head().iterrows():
    print(f"Row {idx}: Open={row['Open']}, Close={row['Close']}")
