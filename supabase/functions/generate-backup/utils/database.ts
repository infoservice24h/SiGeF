import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function backupDatabase(supabaseClient: ReturnType<typeof createClient>) {
  const backup = {
    schema: {
      types: [],
      tables: [],
      policies: [],
      functions: [],
      triggers: []
    },
    data: {}
  }

  // Get database schema
  const { data: types } = await supabaseClient.rpc('get_custom_types')
  backup.schema.types = types || []

  const { data: tables } = await supabaseClient.rpc('get_tables_structure')
  backup.schema.tables = tables || []

  const { data: policies } = await supabaseClient.rpc('get_rls_policies')
  backup.schema.policies = policies || []

  const { data: functions } = await supabaseClient.rpc('get_functions')
  backup.schema.functions = functions || []

  const { data: triggers } = await supabaseClient.rpc('get_triggers')
  backup.schema.triggers = triggers || []

  // Backup table data
  const tables_to_backup = [
    'profiles',
    'movimentacoes',
    'movimentacoes_audit',
    'movimentacao_comments',
    'chat_messages',
    'system_logs'
  ]

  for (const table of tables_to_backup) {
    const { data, error } = await supabaseClient
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    backup.data[table] = data
  }

  return backup
}