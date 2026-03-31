# TabTrad

App web para organizar músicas de ensaio de dança, com foco em:

- catálogo por grupo, coreografia ou evento;
- reprodução rápida;
- compartilhamento por link ou por usuário;
- armazenamento em nuvem com custo baixo.

## Stack recomendada

- `Next.js` para frontend e rotas do app
- `Supabase Auth` para usuários
- `Supabase Postgres` para metadados e permissões
- `Supabase Storage` para iniciar rápido
- `Cloudflare R2` como evolução barata para armazenar os áudios

## Modelo inicial

### Tabelas

- `profiles`: vínculo com o usuário autenticado
- `tracks`: cadastro da música
- `collections`: playlists, ensaios ou repertórios
- `collection_tracks`: ordem das músicas dentro da coleção
- `track_access`: permissões adicionais por usuário ou grupo

### Campos importantes em `tracks`

- `id`
- `title`
- `artist`
- `notes`
- `storage_provider`
- `storage_path`
- `uploaded_by`
- `visibility`
- `duration_seconds`

## Estratégia de custo

1. Começar com tudo no Supabase para validar uso.
2. Quando houver mais volume de arquivos, manter auth e banco no Supabase.
3. Migrar apenas o arquivo bruto para `Cloudflare R2`.
4. Servir áudio por URL assinada ou pública conforme a regra de acesso.

## Próximos passos técnicos

1. Criar projeto no Supabase.
2. Configurar `.env.local` com as chaves.
3. Rodar `supabase/schema.sql` no SQL Editor.
4. Abrir `/biblioteca`, criar conta e fazer upload de uma faixa.
5. Criar página pública por coleção compartilhada.
6. Adicionar player persistente e busca por tags.

## Fluxo já implementado

- login por email e senha;
- criação de conta;
- upload para o bucket privado `tracks`;
- gravação dos metadados na tabela `tracks`;
- listagem das faixas do usuário;
- reprodução via signed URL.
