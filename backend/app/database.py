import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

_client: Client = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        try:
            from postgrest._sync.request_builder import SyncMaybeSingleRequestBuilder
            if not hasattr(SyncMaybeSingleRequestBuilder, "_patched"):
                orig_execute = SyncMaybeSingleRequestBuilder.execute
                
                class DummyResponse:
                    def __init__(self):
                        self.data = None
                        self.count = None
                
                def safe_execute(self, *args, **kwargs):
                    res = orig_execute(self, *args, **kwargs)
                    return res if res is not None else DummyResponse()
                    
                SyncMaybeSingleRequestBuilder.execute = safe_execute
                SyncMaybeSingleRequestBuilder._patched = True
        except Exception as e:
            print("[Database] Failed to patch SyncMaybeSingleRequestBuilder:", e)
            
    return _client
