import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { backupDatabase } from './utils/database.ts'
import { backupFrontend } from './utils/frontend.ts'
import { backupBackend } from './utils/backend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar se o usuário é admin
    const { userId } = await req.json()
    const { data: userProfile, error: userError } = await supabaseClient
      .from('profiles')
      .select('papel')
      .eq('id', userId)
      .single()

    if (userError || userProfile?.papel !== 'admin') {
      throw new Error('Acesso não autorizado')
    }

    // Generate complete backup
    const backup = {
      metadata: {
        version: '2.0',
        timestamp: new Date().toISOString(),
        generated_by: userId
      },
      database: await backupDatabase(supabaseClient),
      frontend: await backupFrontend(supabaseClient),
      backend: await backupBackend(supabaseClient)
    }

    console.log('Backup completo gerado com sucesso')

    return new Response(
      JSON.stringify(backup, null, 2),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename=backup-completo.json'
        }
      }
    )
  } catch (error) {
    console.error('Erro ao gerar backup:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})