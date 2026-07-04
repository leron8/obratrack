-- RLS Policies for multi-tenant row-level access.

set role anon;

-- Enable RLS on all company-owned tables.

alter table if exists profiles enable row level security;
alter table if exists clients enable row level security;
alter table if exists suppliers enable row level security;
alter table if exists projects enable row level security;
alter table if exists employees enable row level security;
alter table if exists project_employees enable row level security;
alter table if exists vehicles enable row level security;
alter table if exists vehicle_assignments enable row level security;
alter table if exists expense_categories enable row level security;
alter table if exists materials enable row level security;
alter table if exists purchase_orders enable row level security;
alter table if exists purchase_items enable row level security;
alter table if exists documents enable row level security;
alter table if exists transactions enable row level security;
alter table if exists transaction_confirmations enable row level security;
alter table if exists accounts enable row level security;
alter table if exists transfers enable row level security;
alter table if exists cost_centers enable row level security;
alter table if exists allocation_rules enable row level security;
alter table if exists cost_allocations enable row level security;

-- Policy helper: current company id from JWT claims
create policy if not exists company_is_current for companies using (id = current_setting('request.jwt.claims.company_id', true)::uuid);

create policy if not exists profiles_company_policy for profiles using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists clients_company_policy for clients using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists suppliers_company_policy for suppliers using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists projects_company_policy for projects using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists employees_company_policy for employees using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists project_employees_company_policy for project_employees using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists vehicles_company_policy for vehicles using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists vehicle_assignments_company_policy for vehicle_assignments using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists expense_categories_company_policy for expense_categories using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists materials_company_policy for materials using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists purchase_orders_company_policy for purchase_orders using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists purchase_items_company_policy for purchase_items using (
  purchase_order_id in (select id from purchase_orders where company_id = current_setting('request.jwt.claims.company_id', true)::uuid));
create policy if not exists documents_company_policy for documents using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transactions_company_policy for transactions using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transaction_confirmations_company_policy for transaction_confirmations using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists accounts_company_policy for accounts using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transfers_company_policy for transfers using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_centers_company_policy for cost_centers using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists allocation_rules_company_policy for allocation_rules using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_allocations_company_policy for cost_allocations using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);

-- Allow users to insert only rows in their company.
create policy if not exists profiles_insert_company_policy for profiles with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists clients_insert_company_policy for clients with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists suppliers_insert_company_policy for suppliers with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists projects_insert_company_policy for projects with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists employees_insert_company_policy for employees with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists project_employees_insert_company_policy for project_employees with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists vehicles_insert_company_policy for vehicles with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists vehicle_assignments_insert_company_policy for vehicle_assignments with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists expense_categories_insert_company_policy for expense_categories with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists materials_insert_company_policy for materials with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists purchase_orders_insert_company_policy for purchase_orders with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists documents_insert_company_policy for documents with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transactions_insert_company_policy for transactions with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transaction_confirmations_insert_company_policy for transaction_confirmations with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists accounts_insert_company_policy for accounts with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transfers_insert_company_policy for transfers with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_centers_insert_company_policy for cost_centers with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists allocation_rules_insert_company_policy for allocation_rules with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_allocations_insert_company_policy for cost_allocations with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);

-- Allow users to update/delete only rows in their company.
create policy if not exists clients_update_company_policy for clients using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists projects_update_company_policy for projects using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transactions_update_company_policy for transactions using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists accounts_update_company_policy for accounts using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists transfers_update_company_policy for transfers using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_centers_update_company_policy for cost_centers using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists allocation_rules_update_company_policy for allocation_rules using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
create policy if not exists cost_allocations_update_company_policy for cost_allocations using (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
) with check (
  company_id = current_setting('request.jwt.claims.company_id', true)::uuid
);
