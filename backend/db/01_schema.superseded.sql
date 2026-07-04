-- Multi-tenant Construction Management Schema
-- PostgreSQL 16 / Supabase compatible

create extension if not exists "uuid-ossp";

-- Companies
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  industry text,
  address text,
  timezone text default 'UTC',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Profiles / Users
create table if not exists profiles (
  id uuid primary key,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create unique index if not exists idx_profiles_company_email on profiles(company_id, email);

-- Clients
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Suppliers
create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Projects
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'planning',
  budget numeric(18,2) default 0,
  start_date date,
  estimated_end_date date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- Employees
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  position text,
  salary numeric(18,2) default 0,
  status text not null default 'active',
  hire_date date,
  termination_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table if not exists project_employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vehicles
create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  plate text not null,
  model text,
  type text,
  status text not null default 'available',
  purchase_date date,
  value numeric(18,2) default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table if not exists vehicle_assignments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Expense categories
create table if not exists expense_categories (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Materials and purchases
create table if not exists materials (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  sku text,
  name text not null,
  unit text,
  category text,
  cost_per_unit numeric(18,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  project_id uuid references projects(id),
  order_date date not null default current_date,
  total_amount numeric(18,2) default 0,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table if not exists purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  material_id uuid not null references materials(id),
  quantity numeric(18,4) not null default 0,
  unit_price numeric(18,2) not null default 0,
  total_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documents
-- Unified financial transactions
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id),
  client_id uuid references clients(id),
  supplier_id uuid references suppliers(id),
  employee_id uuid references employees(id),
  vehicle_id uuid references vehicles(id),
  category_id uuid references expense_categories(id),
  document_id uuid references documents(id),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  amount numeric(18,2) not null default 0,
  currency text not null default 'USD',
  description text,
  payment_method text,
  receipt_url text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id),
  transaction_id uuid references transactions(id),
  uploaded_by uuid,
  url text not null,
  type text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transaction_confirmations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  from_whatsapp text not null,
  parsed jsonb not null,
  transcript text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes optimized for multi-tenant filtering and reporting
create index if not exists idx_profiles_company_status on profiles(company_id, status);
create index if not exists idx_clients_company_status on clients(company_id, status);
create index if not exists idx_suppliers_company_status on suppliers(company_id, status);
create index if not exists idx_projects_company_status on projects(company_id, status);
create index if not exists idx_employees_company_status on employees(company_id, status);
create index if not exists idx_vehicles_company_status on vehicles(company_id, status);
create index if not exists idx_transactions_company_project_date on transactions(company_id, project_id, occurred_at desc);
create index if not exists idx_transactions_company_type_date on transactions(company_id, transaction_type, occurred_at desc);
create index if not exists idx_purchase_orders_company_status on purchase_orders(company_id, status);
create index if not exists idx_purchase_items_order_material on purchase_items(purchase_order_id, material_id);
create index if not exists idx_documents_company_project on documents(company_id, project_id);
