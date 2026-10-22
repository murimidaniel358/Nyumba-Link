import { createClient } from
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vswfccshobtvwthraoid.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IF7vWPsJQM2xB78P3OC6DA_qKZpDAuq';

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);