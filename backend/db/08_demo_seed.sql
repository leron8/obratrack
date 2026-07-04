-- ═════════════════════════════════════════════════════════════════════════
-- Demo seed for the REAGA MVP ERP schema (00_rebuild_mvp_erp_schema.sql)
-- Run this AFTER applying 00_rebuild_mvp_erp_schema.sql
-- ═════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Demo company (id matches DEFAULT_COMPANY_ID in .env) ───────────

INSERT INTO public.companies (
  id, name, legal_name, slug, industry, timezone, currency
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Company',
  'Demo Company S.A. de C.V.',
  'demo-company',
  'construction',
  'America/Mexico_City',
  'MXN'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  slug = EXCLUDED.slug,
  industry = EXCLUDED.industry,
  timezone = EXCLUDED.timezone,
  currency = EXCLUDED.currency,
  updated_at = now();

-- ── 2. Expense categories ─────────────────────────────────────────────

INSERT INTO public.expense_categories (company_id, name, classification, code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Materiales', 'DIRECT', 'MAT'),
  ('00000000-0000-0000-0000-000000000001', 'Mano de obra', 'DIRECT', 'LAB'),
  ('00000000-0000-0000-0000-000000000001', 'Combustible', 'DIRECT', 'FUEL'),
  ('00000000-0000-0000-0000-000000000001', 'Maquinaria', 'DIRECT', 'MACH'),
  ('00000000-0000-0000-0000-000000000001', 'Subcontratos', 'DIRECT', 'SUBC'),
  ('00000000-0000-0000-0000-000000000001', 'Oficina', 'INDIRECT', 'OFF'),
  ('00000000-0000-0000-0000-000000000001', 'Seguros', 'INDIRECT', 'INS'),
  ('00000000-0000-0000-0000-000000000001', 'Impuestos', 'INDIRECT', 'TAX'),
  ('00000000-0000-0000-0000-000000000001', 'Servicios', 'INDIRECT', 'SVC'),
  ('00000000-0000-0000-0000-000000000001', 'Varios', 'INDIRECT', 'MISC')
ON CONFLICT (company_id, name) DO NOTHING;

-- ── 3. Cost centers ───────────────────────────────────────────────────

INSERT INTO public.cost_centers (company_id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Administración', 'ADMIN'),
  ('00000000-0000-0000-0000-000000000001', 'Operaciones', 'OPS'),
  ('00000000-0000-0000-0000-000000000001', 'Ventas', 'SALES')
ON CONFLICT (company_id, name) DO NOTHING;

-- ── 4. Business partners (clients & suppliers) ────────────────────────

INSERT INTO public.business_partners (company_id, partner_type, name, legal_name, rfc, email, phone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'client', 'Constructora del Norte', 'Constructora del Norte S.A.', 'CNO123456XYZ', 'contacto@constructoranorte.com', '555-100-2000'),
  ('00000000-0000-0000-0000-000000000001', 'client', 'Inmobiliaria Reforma', 'Inmobiliaria Reforma S.A. de C.V.', 'IRF789012ABC', 'info@inmobiliariareforma.com', '555-200-3000'),
  ('00000000-0000-0000-0000-000000000001', 'client', 'Gobierno Municipal', 'Ayuntamiento de la Ciudad', 'GMC345678DEF', 'tesoreria@municipio.gob.mx', '555-300-4000'),
  ('00000000-0000-0000-0000-000000000001', 'supplier', 'Materiales García', 'Materiales García S.A.', 'MGA901234GHI', 'ventas@materialesgarcia.com', '555-400-5000'),
  ('00000000-0000-0000-0000-000000000001', 'supplier', 'Cemex', 'Cemex México S.A.', 'CMX567890JKL', 'facturacion@cemex.com', '555-500-6000'),
  ('00000000-0000-0000-0000-000000000001', 'supplier', 'Oxxo Gas', 'Fomento Económico Mexicano', 'FEM234567MNO', 'oxxogas@femsa.com', '555-600-7000'),
  ('00000000-0000-0000-0000-000000000001', 'supplier', 'Ferremayorista', 'Ferremayorista S.A.', 'FMA890123PQR', 'pedidos@ferremayorista.com', '555-700-8000'),
  ('00000000-0000-0000-0000-000000000001', 'contractor', 'Electricistas Unidos', 'Electricistas Unidos S.C.', 'EUS456789STU', 'obras@electricistasunidos.com', '555-800-9000')
ON CONFLICT (company_id, partner_type, name) DO NOTHING;

-- ── 5. Projects ───────────────────────────────────────────────────────

INSERT INTO public.projects (company_id, client_id, code, name, status, budget, start_date, estimated_end_date) VALUES
  ('00000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.business_partners WHERE company_id = '00000000-0000-0000-0000-000000000001' AND partner_type = 'client' AND name = 'Constructora del Norte'),
   'OBR-2024-001', 'Edificio Plaza Central', 'active', 2500000.00, '2024-01-15', '2024-12-20'),
  ('00000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.business_partners WHERE company_id = '00000000-0000-0000-0000-000000000001' AND partner_type = 'client' AND name = 'Inmobiliaria Reforma'),
   'OBR-2024-002', 'Residencial Los Pinos', 'active', 1800000.00, '2024-03-01', '2025-02-28'),
  ('00000000-0000-0000-0000-000000000001',
   (SELECT id FROM public.business_partners WHERE company_id = '00000000-0000-0000-0000-000000000001' AND partner_type = 'client' AND name = 'Gobierno Municipal'),
   'OBR-2024-003', 'Puente Vehicular Norte', 'planning', 3200000.00, '2024-06-01', '2025-05-31'),
  ('00000000-0000-0000-0000-000000000001', NULL,
   'OBR-2024-004', 'Mantenimiento Flotilla', 'active', 350000.00, '2024-01-01', '2024-12-31')
ON CONFLICT (company_id, name) DO NOTHING;

-- ── 6. Employees ──────────────────────────────────────────────────────

INSERT INTO public.employees (company_id, employee_code, worker_type, first_name, last_name, position, default_weekly_salary, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'EMP-001', 'employee', 'Juan', 'Pérez López', 'Supervisor de obra', 4500.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-002', 'employee', 'María', 'García Hernández', 'Ingeniera civil', 5500.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-003', 'employee', 'Carlos', 'Martínez Ruiz', 'Albañil', 3200.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-004', 'employee', 'Ana', 'Rodríguez Cruz', 'Contadora', 5000.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-005', 'destajista', 'Pedro', 'Sánchez Gómez', 'Fierrero', 3800.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-006', 'employee', 'Luis', 'Torres Flores', 'Operador de maquinaria', 4000.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-007', 'employee', 'Sofía', 'Díaz Mendoza', 'Asistente administrativa', 3500.00, 'active'),
  ('00000000-0000-0000-0000-000000000001', 'EMP-008', 'contractor', 'Roberto', 'Vega Castillo', 'Chofer', 3000.00, 'active')
ON CONFLICT (company_id, employee_code) DO NOTHING;

-- ── 7. Project workers ────────────────────────────────────────────────

INSERT INTO public.project_workers (company_id, project_id, employee_id, assigned_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  e.id,
  '2024-01-15'::date
FROM public.projects p, public.employees e
WHERE p.company_id = '00000000-0000-0000-0000-000000000001'
  AND e.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.code = 'OBR-2024-001'
  AND e.employee_code IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-005', 'EMP-006')
ON CONFLICT DO NOTHING;

-- ── 8. Vehicles ───────────────────────────────────────────────────────

INSERT INTO public.vehicles (company_id, plate, model_name, model_year, vehicle_type, status, default_project_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ABC-1234', 'Ford F-350', 2022, 'pickup', 'active',
   (SELECT id FROM public.projects WHERE company_id = '00000000-0000-0000-0000-000000000001' AND code = 'OBR-2024-001')),
  ('00000000-0000-0000-0000-000000000001', 'DEF-5678', 'Chevrolet Silverado', 2023, 'pickup', 'active',
   (SELECT id FROM public.projects WHERE company_id = '00000000-0000-0000-0000-000000000001' AND code = 'OBR-2024-002')),
  ('00000000-0000-0000-0000-000000000001', 'GHI-9012', 'Nissan NP300', 2021, 'pickup', 'active', NULL),
  ('00000000-0000-0000-0000-000000000001', 'JKL-3456', 'Kenworth T680', 2023, 'tractor', 'active', NULL)
ON CONFLICT (company_id, plate) DO NOTHING;

-- ── 9. Financial accounts ─────────────────────────────────────────────

INSERT INTO public.financial_accounts (company_id, name, account_type, currency, opening_balance, opening_balance_date, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Banorte principal', 'bank', 'MXN', 150000.00, '2024-01-01', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'Caja chica obra', 'cash', 'MXN', 15000.00, '2024-01-01', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'Tarjeta empresarial Banorte', 'credit_card', 'MXN', 0.00, '2024-01-01', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'Oxxo Gas corporativo', 'fuel_card', 'MXN', 0.00, '2024-01-01', 'active')
ON CONFLICT (company_id, name) DO NOTHING;

-- ── 10. Account movements (sample transactions) ───────────────────────

-- Helper: get account id
DO $$
DECLARE
  v_company_id uuid := '00000000-0000-0000-0000-000000000001';
  v_banorte uuid;
  v_caja uuid;
  v_tarjeta uuid;
  v_oxxo uuid;
  v_proj1 uuid;
  v_proj2 uuid;
  v_proj3 uuid;
  v_cliente1 uuid;
  v_cliente2 uuid;
  v_cliente3 uuid;
  v_prov_mat uuid;
  v_prov_cem uuid;
  v_prov_fer uuid;
  v_emp1 uuid;
  v_emp2 uuid;
  v_emp3 uuid;
  v_emp4 uuid;
  v_emp6 uuid;
  v_veh1 uuid;
  v_veh2 uuid;
  v_cat_mat uuid;
  v_cat_lab uuid;
  v_cat_fuel uuid;
  v_cat_mach uuid;
  v_cat_off uuid;
  v_cat_svc uuid;
BEGIN
  SELECT id INTO v_banorte FROM public.financial_accounts WHERE company_id = v_company_id AND name = 'Banorte principal';
  SELECT id INTO v_caja FROM public.financial_accounts WHERE company_id = v_company_id AND name = 'Caja chica obra';
  SELECT id INTO v_tarjeta FROM public.financial_accounts WHERE company_id = v_company_id AND name = 'Tarjeta empresarial Banorte';
  SELECT id INTO v_oxxo FROM public.financial_accounts WHERE company_id = v_company_id AND name = 'Oxxo Gas corporativo';

  SELECT id INTO v_proj1 FROM public.projects WHERE company_id = v_company_id AND code = 'OBR-2024-001';
  SELECT id INTO v_proj2 FROM public.projects WHERE company_id = v_company_id AND code = 'OBR-2024-002';
  SELECT id INTO v_proj3 FROM public.projects WHERE company_id = v_company_id AND code = 'OBR-2024-003';

  SELECT id INTO v_cliente1 FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'client' AND name = 'Constructora del Norte';
  SELECT id INTO v_cliente2 FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'client' AND name = 'Inmobiliaria Reforma';
  SELECT id INTO v_cliente3 FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'client' AND name = 'Gobierno Municipal';

  SELECT id INTO v_prov_mat FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'supplier' AND name = 'Materiales García';
  SELECT id INTO v_prov_cem FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'supplier' AND name = 'Cemex';
  SELECT id INTO v_prov_fer FROM public.business_partners WHERE company_id = v_company_id AND partner_type = 'supplier' AND name = 'Ferremayorista';

  SELECT id INTO v_emp1 FROM public.employees WHERE company_id = v_company_id AND employee_code = 'EMP-001';
  SELECT id INTO v_emp2 FROM public.employees WHERE company_id = v_company_id AND employee_code = 'EMP-002';
  SELECT id INTO v_emp3 FROM public.employees WHERE company_id = v_company_id AND employee_code = 'EMP-003';
  SELECT id INTO v_emp4 FROM public.employees WHERE company_id = v_company_id AND employee_code = 'EMP-004';
  SELECT id INTO v_emp6 FROM public.employees WHERE company_id = v_company_id AND employee_code = 'EMP-006';

  SELECT id INTO v_veh1 FROM public.vehicles WHERE company_id = v_company_id AND plate = 'ABC-1234';
  SELECT id INTO v_veh2 FROM public.vehicles WHERE company_id = v_company_id AND plate = 'DEF-5678';

  SELECT id INTO v_cat_mat FROM public.expense_categories WHERE company_id = v_company_id AND code = 'MAT';
  SELECT id INTO v_cat_lab FROM public.expense_categories WHERE company_id = v_company_id AND code = 'LAB';
  SELECT id INTO v_cat_fuel FROM public.expense_categories WHERE company_id = v_company_id AND code = 'FUEL';
  SELECT id INTO v_cat_mach FROM public.expense_categories WHERE company_id = v_company_id AND code = 'MACH';
  SELECT id INTO v_cat_off FROM public.expense_categories WHERE company_id = v_company_id AND code = 'OFF';
  SELECT id INTO v_cat_svc FROM public.expense_categories WHERE company_id = v_company_id AND code = 'SVC';

  -- Client income (January)
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, business_partner_id, project_id, description, source_module)
  VALUES
    (v_company_id, v_banorte, '2024-01-15', 'in', 'client_income', 350000.00, 'MXN', 'bank_transfer', 'posted', v_cliente1, v_proj1, 'Pago inicial Edificio Plaza Central', 'manual'),
    (v_company_id, v_banorte, '2024-01-20', 'in', 'client_income', 200000.00, 'MXN', 'bank_transfer', 'posted', v_cliente2, v_proj2, 'Anticipo Residencial Los Pinos', 'manual'),
    (v_company_id, v_banorte, '2024-02-15', 'in', 'client_income', 350000.00, 'MXN', 'bank_transfer', 'posted', v_cliente1, v_proj1, 'Segundo pago Edificio Plaza Central', 'manual'),
    (v_company_id, v_banorte, '2024-03-01', 'in', 'client_income', 500000.00, 'MXN', 'bank_transfer', 'posted', v_cliente3, v_proj3, 'Fondo inicial Puente Vehicular Norte', 'manual'),
    (v_company_id, v_banorte, '2024-03-15', 'in', 'client_income', 350000.00, 'MXN', 'bank_transfer', 'posted', v_cliente1, v_proj1, 'Tercer pago Edificio Plaza Central', 'manual');

  -- Material purchases
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, business_partner_id, project_id, expense_category_id, description, source_module)
  VALUES
    (v_company_id, v_banorte, '2024-01-20', 'out', 'expense', 85000.00, 'MXN', 'bank_transfer', 'posted', v_prov_mat, v_proj1, v_cat_mat, 'Compra de cemento y varilla', 'manual'),
    (v_company_id, v_banorte, '2024-01-25', 'out', 'expense', 120000.00, 'MXN', 'bank_transfer', 'posted', v_prov_cem, v_proj1, v_cat_mat, 'Concreto premezclado', 'manual'),
    (v_company_id, v_banorte, '2024-02-05', 'out', 'expense', 45000.00, 'MXN', 'bank_transfer', 'posted', v_prov_fer, v_proj2, v_cat_mat, 'Herramienta y ferretería', 'manual'),
    (v_company_id, v_banorte, '2024-02-10', 'out', 'expense', 95000.00, 'MXN', 'bank_transfer', 'posted', v_prov_mat, v_proj1, v_cat_mat, 'Block y tabique', 'manual'),
    (v_company_id, v_banorte, '2024-03-05', 'out', 'expense', 78000.00, 'MXN', 'bank_transfer', 'posted', v_prov_cem, v_proj2, v_cat_mat, 'Cemento y arena', 'manual');

  -- Payroll payments
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, employee_id, project_id, expense_category_id, description, source_module)
  VALUES
    (v_company_id, v_banorte, '2024-01-26', 'out', 'payroll_payment', 45000.00, 'MXN', 'bank_transfer', 'posted', v_emp1, v_proj1, v_cat_lab, 'Nómina semanal supervisión', 'manual'),
    (v_company_id, v_banorte, '2024-01-26', 'out', 'payroll_payment', 32000.00, 'MXN', 'bank_transfer', 'posted', v_emp3, v_proj1, v_cat_lab, 'Nómina semanal albañilería', 'manual'),
    (v_company_id, v_banorte, '2024-02-02', 'out', 'payroll_payment', 45000.00, 'MXN', 'bank_transfer', 'posted', v_emp1, v_proj1, v_cat_lab, 'Nómina semanal supervisión', 'manual'),
    (v_company_id, v_banorte, '2024-02-02', 'out', 'payroll_payment', 32000.00, 'MXN', 'bank_transfer', 'posted', v_emp3, v_proj1, v_cat_lab, 'Nómina semanal albañilería', 'manual'),
    (v_company_id, v_banorte, '2024-02-02', 'out', 'payroll_payment', 40000.00, 'MXN', 'bank_transfer', 'posted', v_emp6, v_proj1, v_cat_mach, 'Nómina operador maquinaria', 'manual');

  -- Fuel expenses
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, vehicle_id, project_id, expense_category_id, description, source_module)
  VALUES
    (v_company_id, v_oxxo, '2024-01-22', 'out', 'fuel_expense', 3200.00, 'MXN', 'fuel_card', 'posted', v_veh1, v_proj1, v_cat_fuel, 'Gasolina Ford F-350', 'manual'),
    (v_company_id, v_oxxo, '2024-02-05', 'out', 'fuel_expense', 2800.00, 'MXN', 'fuel_card', 'posted', v_veh1, v_proj1, v_cat_fuel, 'Gasolina Ford F-350', 'manual'),
    (v_company_id, v_oxxo, '2024-02-12', 'out', 'fuel_expense', 3500.00, 'MXN', 'fuel_card', 'posted', v_veh2, v_proj2, v_cat_fuel, 'Gasolina Cheyenne', 'manual'),
    (v_company_id, v_oxxo, '2024-03-01', 'out', 'fuel_expense', 3100.00, 'MXN', 'fuel_card', 'posted', v_veh1, v_proj1, v_cat_fuel, 'Gasolina Ford F-350', 'manual');

  -- Office expenses
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, expense_category_id, description, source_module)
  VALUES
    (v_company_id, v_caja, '2024-01-18', 'out', 'expense', 3500.00, 'MXN', 'cash', 'posted', v_cat_off, 'Papelería y útiles oficina', 'manual'),
    (v_company_id, v_banorte, '2024-02-01', 'out', 'expense', 8500.00, 'MXN', 'bank_transfer', 'posted', v_cat_svc, 'Servicio de internet y telefonía', 'manual'),
    (v_company_id, v_caja, '2024-02-15', 'out', 'expense', 2200.00, 'MXN', 'cash', 'posted', v_cat_off, 'Cafetería y consumibles', 'manual'),
    (v_company_id, v_banorte, '2024-03-01', 'out', 'expense', 8500.00, 'MXN', 'bank_transfer', 'posted', v_cat_svc, 'Servicio de internet y telefonía', 'manual');

  -- Bank fee
  INSERT INTO public.account_movements (company_id, account_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, description, source_module)
  VALUES
    (v_company_id, v_banorte, '2024-01-31', 'out', 'bank_fee', 450.00, 'MXN', 'bank_transfer', 'posted', 'Comisión mensual Banorte', 'manual'),
    (v_company_id, v_banorte, '2024-02-29', 'out', 'bank_fee', 450.00, 'MXN', 'bank_transfer', 'posted', 'Comisión mensual Banorte', 'manual'),
    (v_company_id, v_banorte, '2024-03-31', 'out', 'bank_fee', 450.00, 'MXN', 'bank_transfer', 'posted', 'Comisión mensual Banorte', 'manual');

  -- Internal transfer (Banorte -> Caja chica)
  INSERT INTO public.account_transfers (company_id, from_account_id, to_account_id, transfer_date, amount, description)
  VALUES (v_company_id, v_banorte, v_caja, '2024-01-15', 10000.00, 'Fondeo caja chica');

  INSERT INTO public.account_movements (company_id, account_id, transfer_id, movement_date, direction, movement_kind, amount, currency, payment_method, status, is_internal_transfer, description, source_module)
  VALUES
    (v_company_id, v_banorte, (SELECT id FROM public.account_transfers WHERE company_id = v_company_id AND from_account_id = v_banorte AND to_account_id = v_caja AND transfer_date = '2024-01-15' LIMIT 1),
     '2024-01-15', 'out', 'internal_transfer', 10000.00, 'MXN', 'bank_transfer', 'posted', true, 'Transferencia a caja chica', 'manual'),
    (v_company_id, v_caja, (SELECT id FROM public.account_transfers WHERE company_id = v_company_id AND from_account_id = v_banorte AND to_account_id = v_caja AND transfer_date = '2024-01-15' LIMIT 1),
     '2024-01-15', 'in', 'internal_transfer', 10000.00, 'MXN', 'cash', 'posted', true, 'Recepción de caja chica', 'manual');

END$$;

-- ── 11. Fuel cards ────────────────────────────────────────────────────

INSERT INTO public.fuel_cards (company_id, account_id, provider, card_number, card_alias, vehicle_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  fa.id,
  'OXXO GAS',
  '4000' || LPAD(ROW_NUMBER() OVER ()::text, 12, '0'),
  'Tarjeta ' || v.plate,
  v.id
FROM public.financial_accounts fa
CROSS JOIN public.vehicles v
WHERE fa.company_id = '00000000-0000-0000-0000-000000000001'
  AND fa.account_type = 'fuel_card'
  AND v.company_id = '00000000-0000-0000-0000-000000000001'
  AND v.plate IN ('ABC-1234', 'DEF-5678')
ON CONFLICT (company_id, provider, card_number) DO NOTHING;

-- ── 12. Fuel stations ─────────────────────────────────────────────────

INSERT INTO public.fuel_stations (company_id, provider, station_code, name, city) VALUES
  ('00000000-0000-0000-0000-000000000001', 'OXXO GAS', 'OX-001', 'Oxxo Gas Centro', 'Monterrey'),
  ('00000000-0000-0000-0000-000000000001', 'OXXO GAS', 'OX-002', 'Oxxo Gas Norte', 'Monterrey'),
  ('00000000-0000-0000-0000-000000000001', 'OXXO GAS', 'OX-003', 'Oxxo Gas Sur', 'Monterrey')
ON CONFLICT (company_id, provider, station_code) DO NOTHING;

-- ── 13. Recurring obligations ─────────────────────────────────────────

INSERT INTO public.recurring_obligations (company_id, name, expected_amount, currency, due_day, next_due_date, expense_category_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Renta oficina', 15000.00, 'MXN', 5, '2024-04-05',
   (SELECT id FROM public.expense_categories WHERE company_id = '00000000-0000-0000-0000-000000000001' AND code = 'OFF')),
  ('00000000-0000-0000-0000-000000000001', 'Internet y telefonía', 2500.00, 'MXN', 10, '2024-04-10',
   (SELECT id FROM public.expense_categories WHERE company_id = '00000000-0000-0000-0000-000000000001' AND code = 'SVC')),
  ('00000000-0000-0000-0000-000000000001', 'Seguro flotilla', 8500.00, 'MXN', 15, '2024-04-15',
   (SELECT id FROM public.expense_categories WHERE company_id = '00000000-0000-0000-0000-000000000001' AND code = 'INS'))
ON CONFLICT DO NOTHING;

COMMIT;