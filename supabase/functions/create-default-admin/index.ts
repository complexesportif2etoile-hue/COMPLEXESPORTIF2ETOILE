import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuration manquante" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const email = "admin@terrains.sn";
    const password = "Admin123456!";

    // Créer l'utilisateur auth
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
      }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.text();
      console.log("Auth error:", errorData);

      if (authResponse.status === 422) {
        return new Response(
          JSON.stringify({
            message: "L'utilisateur admin existe déjà",
            email,
            password
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`Erreur création utilisateur: ${errorData}`);
    }

    const userData = await authResponse.json();
    console.log("Auth response:", userData);

    if (!userData.user || !userData.user.id) {
      throw new Error("Utilisateur non créé correctement");
    }

    const userId = userData.user.id;

    // Créer le profil
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        id: userId,
        email,
        full_name: "Administrateur",
        role: "admin",
      }),
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.text();
      console.log("Profile error:", errorData);
      throw new Error(`Erreur création profil: ${errorData}`);
    }

    return new Response(
      JSON.stringify({
        message: "Utilisateur admin créé avec succès",
        email,
        password,
        userId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
