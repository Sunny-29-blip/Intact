-- Migration: report dashboard and quick checks support
-- Safe to run once (idempotent)

-- 1. Add is_quick_check to properties if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'properties' and column_name = 'is_quick_check'
  ) then
    alter table properties add column is_quick_check boolean not null default false;
  end if;
end $$;

-- 2. Add issue_type to findings if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'findings' and column_name = 'issue_type'
  ) then
    alter table findings add column issue_type text;
  end if;
end $$;

-- 3. Create index on properties.is_quick_check and findings.issue_type
create index if not exists idx_properties_is_quick_check on properties(is_quick_check);
create index if not exists idx_findings_issue_type on findings(issue_type);
