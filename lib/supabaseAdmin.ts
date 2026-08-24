import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.ncleeeywbznpacxxhqhd.supabase.co!,
  process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbGVlZXl3YnpucGFjeHhocWhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU4MTc2NCwiZXhwIjoyMTAzMTU3NzY0fQ.ZFK7A3Lq9z9ss4IWk4OBMGci5a7TnH6uqAciuzwHDIQ!
);
