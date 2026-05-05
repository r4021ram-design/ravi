from jugaad_data.nse import NSELive
n = NSELive()
print([m for m in dir(n) if not m.startswith('_')])
