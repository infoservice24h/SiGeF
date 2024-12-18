import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { userId, backupData } = await req.json()

    // Verificar se o usuário é admin
    const { data: userProfile, error: userError } = await supabaseClient
      .from('profiles')
      .select('papel')
      .eq('id', userId)
      .single()

    if (userError || userProfile?.papel !== 'admin') {
      throw new Error('Acesso não autorizado')
    }

    // Validar estrutura do backup
    if (!backupData.metadata || !backupData.database || !backupData.frontend || !backupData.backend) {
      throw new Error('Arquivo de backup inválido ou corrompido')
    }

    console.log('Iniciando restauração do backup completo...')

    // 1. Restaurar estrutura e dados do banco
    await supabaseClient.rpc('restore_database_structure', {
      types: backupData.database.schema.types,
      tables: backupData.database.schema.tables,
      policies: backupData.database.schema.policies,
      functions: backupData.database.schema.functions,
      triggers: backupData.database.schema.triggers
    })

    // Restaurar dados
    const tables = Object.keys(backupData.database.data)
    for (const table of tables) {
      await supabaseClient
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (backupData.database.data[table].length > 0) {
        await supabaseClient
          .from(table)
          .insert(backupData.database.data[table])
      }
    }

    // 2. Restaurar código fonte do frontend
    // Criar bucket se não existir
    await supabaseClient
      .storage
      .createBucket('source-code', { public: false })

    // Restaurar arquivos do src
    for (const [filename, content] of Object.entries(backupData.frontend.src)) {
      const blob = new Blob([content as string], { type: 'text/plain' })
      await supabaseClient
        .storage
        .from('source-code')
        .upload(`src/${filename}`, blob, { upsert: true })
    }

    // Restaurar arquivos públicos
    for (const [filename, content] of Object.entries(backupData.frontend.public)) {
      const blob = new Blob([content as string], { type: 'text/plain' })
      await supabaseClient
        .storage
        .from('source-code')
        .upload(`public/${filename}`, blob, { upsert: true })
    }

    // Restaurar arquivos de configuração
    for (const [filename, content] of Object.entries(backupData.frontend.config)) {
      const blob = new Blob([content as string], { type: 'text/plain' })
      await supabaseClient
        .storage
        .from('source-code')
        .upload(filename, blob, { upsert: true })
    }

    // 3. Restaurar backend
    // Restaurar Edge Functions
    for (const [funcName, content] of Object.entries(backupData.backend.edge_functions)) {
      const blob = new Blob([content as string], { type: 'text/plain' })
      await supabaseClient
        .storage
        .from('source-code')
        .upload(`supabase/functions/${funcName}/index.ts`, blob, { upsert: true })
    }

    // Restaurar configuração de autenticação
    if (backupData.backend.auth_config) {
      await supabaseClient
        .from('auth_config')
        .upsert(backupData.backend.auth_config)
    }

    // Restaurar configuração dos buckets de storage
    for (const bucket of backupData.backend.storage) {
      await supabaseClient
        .storage
        .createBucket(bucket.name, { public: bucket.public })
    }

    console.log('Backup restaurado com sucesso')

    return new Response(
      JSON.stringify({ 
        message: 'Backup restaurado com sucesso',
        details: {
          database_restored: true,
          frontend_restored: true,
          backend_restored: true
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Erro ao restaurar backup:', error)
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