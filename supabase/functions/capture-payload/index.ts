import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { method } = req;

  // Handle CORS
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const payload = await req.json();

    // Initialize Supabase Client with Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save payload to database
    const { error } = await supabase
      .from('raw_health_exports')
      .insert([{ payload }]);

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Payload saved to raw_health_exports table.");

    return new Response(
      JSON.stringify({ message: "Payload saved to database", received: true }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({ error: "Failed to process payload", details: error.message }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
})
