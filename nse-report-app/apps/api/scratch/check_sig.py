import inspect
from jugaad_data.nse import NSELive
n = NSELive()
print(inspect.signature(n.index_option_chain))
