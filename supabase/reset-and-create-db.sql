-- Primeiro, remover todas as políticas existentes
drop policy if exists "Permitir leitura para usuários autenticados" on profiles;
drop policy if exists "Usuários podem inserir próprio perfil" on profiles;
drop policy if exists "Usuários podem atualizar próprio perfil" on profiles;
drop policy if exists "Admins podem atualizar qualquer perfil" on profiles;
drop policy if exists "Apenas admins podem deletar perfis" on profiles;
drop policy if exists "Permitir leitura de movimentações" on movimentacoes;
drop policy if exists "Usuários autorizados podem inserir movimentações" on movimentacoes;
drop policy if exists "Tesoureiros e admins podem atualizar movimentações" on movimentacoes;
drop policy if exists "Apenas admins podem deletar movimentações" on movimentacoes;

-- Remover todas as tabelas existentes
drop table if exists movimentacoes;
drop table if exists profiles;

-- Remover tipos customizados
drop type if exists user_role;
drop type if exists conta_tipo;

-- Criar tipos enum necessários
create type user_role as enum ('admin', 'tesoureiro', 'assistente', 'auditor');
create type conta_tipo as enum ('Dinheiro', 'Bradesco', 'Cora');

-- Criar tabela de perfis
create table profiles (
    id uuid references auth.users on delete cascade primary key,
    nome text,
    email text unique,
    papel user_role default 'assistente',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Criar tabela de movimentações
create table movimentacoes (
    id uuid default gen_random_uuid() primary key,
    data date not null default current_date,
    tipo text not null check (tipo in ('entrada', 'saida')),
    conta conta_tipo not null,
    descricao text not null,
    valor decimal(10,2) not null,
    created_by uuid references profiles(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Habilitar RLS em todas as tabelas
alter table profiles enable row level security;
alter table movimentacoes enable row level security;

-- Políticas para profiles
create policy "Permitir leitura de perfis"
on profiles for select
to authenticated
using (true);

create policy "Usuários podem inserir próprio perfil"
on profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Usuários podem atualizar próprio perfil"
on profiles for update
to authenticated
using (auth.uid() = id)
with check (
    auth.uid() = id 
    AND (
        (papel = 'admin'::user_role AND auth.uid() IN (SELECT id FROM profiles WHERE papel = 'admin'::user_role))
        OR papel = (SELECT papel FROM profiles WHERE id = auth.uid())
    )
);

create policy "Admins podem atualizar qualquer perfil"
on profiles for update
to authenticated
using (
    auth.uid() IN (SELECT id FROM profiles WHERE papel = 'admin'::user_role)
);

create policy "Apenas admins podem deletar perfis"
on profiles for delete
to authenticated
using (
    auth.uid() IN (SELECT id FROM profiles WHERE papel = 'admin'::user_role)
);

-- Políticas para movimentacoes
create policy "Permitir leitura de movimentações"
on movimentacoes for select
to authenticated
using (true);

create policy "Usuários autorizados podem inserir movimentações"
on movimentacoes for insert
to authenticated
with check (
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE papel IN ('admin'::user_role, 'tesoureiro'::user_role, 'assistente'::user_role)
    )
);

create policy "Tesoureiros e admins podem atualizar movimentações"
on movimentacoes for update
to authenticated
using (
    auth.uid() IN (
        SELECT id FROM profiles 
        WHERE papel IN ('admin'::user_role, 'tesoureiro'::user_role)
    )
);

create policy "Apenas admins podem deletar movimentações"
on movimentacoes for delete
to authenticated
using (
    auth.uid() IN (SELECT id FROM profiles WHERE papel = 'admin'::user_role)
);

-- Criar funções trigger para updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Criar triggers para atualização automática de updated_at
create trigger update_profiles_updated_at
    before update on profiles
    for each row
    execute function update_updated_at_column();

create trigger update_movimentacoes_updated_at
    before update on movimentacoes
    for each row
    execute function update_updated_at_column();

-- Criar índices para otimização
create index idx_profiles_papel on profiles(papel);
create index idx_movimentacoes_data on movimentacoes(data);
create index idx_movimentacoes_tipo on movimentacoes(tipo);
create index idx_movimentacoes_conta on movimentacoes(conta);