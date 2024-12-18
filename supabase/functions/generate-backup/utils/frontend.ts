import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function backupFrontend(supabaseClient: ReturnType<typeof createClient>) {
  const backup = {
    src: {},
    public: {},
    config: {}
  }

  // Backup source code
  const { data: srcFiles, error: srcError } = await supabaseClient
    .storage
    .from('source-code')
    .list('src')

  if (!srcError && srcFiles) {
    for (const file of srcFiles) {
      const { data: fileContent } = await supabaseClient
        .storage
        .from('source-code')
        .download(`src/${file.name}`)

      if (fileContent) {
        backup.src[file.name] = await fileContent.text()
      }
    }
  }

  // Backup public files
  const { data: publicFiles, error: publicError } = await supabaseClient
    .storage
    .from('source-code')
    .list('public')

  if (!publicError && publicFiles) {
    for (const file of publicFiles) {
      const { data: fileContent } = await supabaseClient
        .storage
        .from('source-code')
        .download(`public/${file.name}`)

      if (fileContent) {
        backup.public[file.name] = await fileContent.text()
      }
    }
  }

  // Backup config files
  const configFiles = ['.env', 'package.json', 'tsconfig.json', 'vite.config.ts']
  for (const file of configFiles) {
    const { data: fileContent } = await supabaseClient
      .storage
      .from('source-code')
      .download(file)

    if (fileContent) {
      backup.config[file] = await fileContent.text()
    }
  }

  return backup
}