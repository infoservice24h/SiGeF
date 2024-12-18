-- Supabase AI is experimental and may produce incorrect answers
-- Always verify the output before executing

-- Primeiro, remover todas as políticas existentes
drop policy if exists "Permitir leitura para usuários autenticados" on profiles;

drop policy if exists "Usuários podem inserir próprio perfil" on profiles;

drop policy if exists "Usuários podem atualizar próprio perfil" on profiles;

drop policy if exists "Admins podem atualizar qualquer perfil" on profiles;

drop policy if exists "Apenas admins podem deletar perfis" on profiles;

-- Remover todas as tabelas existentes
drop table if exists movimentacoes;

drop table if exists profiles cascade;

-- Remover tipos customizados
drop type if exists user_role;

drop type if exists conta_tipo;

-- Criar tipos enum necessários
create type user_role as enum('admin', 'tesoureiro', 'assistente', 'auditor');

create type conta_tipo as enum('Dinheiro', 'Bradesco', 'Cora');

-- Criar tabela de perfis
create table
  profiles (
    id uuid references auth.users on delete cascade primary key,
    nome text,
    email text unique,
    papel user_role default 'assistente',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

-- Criar tabela de movimentações
create table
  movimentacoes (
    id uuid default gen_random_uuid () primary key,
    data date not null default current_date,
    tipo text not null check (tipo in ('entrada', 'saida')),
    conta conta_tipo not null,
    descricao text not null,
    valor decimal(10, 2) not null,
    created_by uuid references profiles (id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

-- Habilitar RLS em todas as tabelas
alter table profiles enable row level security;

alter table movimentacoes enable row level security;

-- Políticas para profiles
create policy "Permitir leitura de perfis" on profiles for
select
  to authenticated using (true);

create policy "Usuários podem inserir próprio perfil" on profiles for insert to authenticated
with
  check (auth.uid () = id);

create policy "Usuários podem atualizar próprio perfil" on profiles
for update
  to authenticated using (auth.uid () = id)
with
  check (
    auth.uid () = id
    and (
      (
        papel = 'admin'::user_role
        and auth.uid () in (
          select
            id
          from
            profiles
          where
            papel = 'admin'::user_role
        )
      )
      or papel = (
        select
          papel
        from
          profiles
        where
          id = auth.uid ()
      )
    )
  );

create policy "Admins podem atualizar qualquer perfil" on profiles
for update
  to authenticated using (
    auth.uid () in (
      select
        id
      from
        profiles
      where
        papel = 'admin'::user_role
    )
  );
