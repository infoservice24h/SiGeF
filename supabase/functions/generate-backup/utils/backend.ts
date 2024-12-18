import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function backupBackend(supabaseClient: ReturnType<typeof createClient>) {
  const backup = {
    edge_functions: {},
    storage: {},
    auth_config: {},
    secrets: []
  }

  // Backup Edge Functions
  const { data: functions_list } = await supabaseClient
    .storage
    .from('source-code')
    .list('supabase/functions')

  if (functions_list) {
    for (const func of functions_list) {
      const { data: functionContent } = await supabaseClient
        .storage
        .from('source-code')
        .download(`supabase/functions/${func.name}/index.ts`)

      if (functionContent) {
        backup.edge_functions[func.name] = await functionContent.text()
      }
    }
  }

  // Backup auth config
  const { data: authConfig } = await supabaseClient
    .from('auth_config')
    .select('*')
    .single()

  if (authConfig) {
    backup.auth_config = authConfig
  }

  // Get secrets list (names only)
  const { data: secretsList } = await supabaseClient
    .from('secrets')
    .select('name')

  if (secretsList) {
    backup.secrets = secretsList.map(s => s.name)
  }

  // Get storage buckets config
  const { data: storageBuckets } = await supabaseClient
    .storage
    .listBuckets()

  if (storageBuckets) {
    backup.storage = storageBuckets
  }

  return backup
}