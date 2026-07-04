-- Reporting views for financial analytics in the construction ERP financial model.

DROP VIEW IF EXISTS public.vw_account_balances;
CREATE VIEW public.vw_account_balances AS
SELECT
  a.id AS account_id,
  a.company_id,
  a.name AS account_name,
  a.account_type,
  a.currency,
  a.opening_balance,
  COALESCE(SUM(CASE WHEN t.transaction_type IN ('income','adjustment','refund') THEN t.amount
                   WHEN t.transaction_type IN ('expense','payroll') THEN -t.amount
                   ELSE 0 END), 0) AS transaction_delta,
  a.opening_balance + COALESCE(SUM(CASE WHEN t.transaction_type IN ('income','adjustment','refund') THEN t.amount
                                     WHEN t.transaction_type IN ('expense','payroll') THEN -t.amount
                                     ELSE 0 END), 0) AS current_balance
FROM public.accounts a
LEFT JOIN public.transactions t ON t.account_id = a.id
GROUP BY a.id, a.company_id, a.name, a.account_type, a.currency, a.opening_balance;

DROP VIEW IF EXISTS public.vw_cash_flow;
CREATE VIEW public.vw_cash_flow AS
SELECT
  company_id,
  COALESCE(transaction_date, occurred_at::date) AS transaction_date,
  SUM(CASE WHEN transaction_type IN ('income','adjustment','refund') THEN amount ELSE 0 END) AS inflow,
  SUM(CASE WHEN transaction_type IN ('expense','payroll') THEN amount ELSE 0 END) AS outflow,
  SUM(CASE WHEN transaction_type IN ('income','adjustment','refund') THEN amount ELSE 0 END) -
  SUM(CASE WHEN transaction_type IN ('expense','payroll') THEN amount ELSE 0 END) AS net_flow
FROM public.transactions
WHERE transaction_type <> 'transfer'
GROUP BY company_id, COALESCE(transaction_date, occurred_at::date);

DROP VIEW IF EXISTS public.vw_expenses_by_category;
CREATE VIEW public.vw_expenses_by_category AS
SELECT
  t.company_id,
  t.expense_category_id,
  ec.name AS category_name,
  ec.classification,
  SUM(t.amount) AS total_amount
FROM public.transactions t
JOIN public.expense_categories ec ON ec.id = t.expense_category_id
WHERE t.transaction_type IN ('expense','payroll')
GROUP BY t.company_id, t.expense_category_id, ec.name, ec.classification;

DROP VIEW IF EXISTS public.vw_expenses_by_cost_center;
CREATE VIEW public.vw_expenses_by_cost_center AS
SELECT
  t.company_id,
  t.cost_center_id,
  cc.name AS cost_center_name,
  SUM(t.amount) AS total_amount
FROM public.transactions t
JOIN public.cost_centers cc ON cc.id = t.cost_center_id
WHERE t.transaction_type IN ('expense','payroll')
GROUP BY t.company_id, t.cost_center_id, cc.name;

DROP VIEW IF EXISTS public.vw_project_profitability;
CREATE VIEW public.vw_project_profitability AS
SELECT
  p.id AS project_id,
  p.company_id,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN t.transaction_type IN ('expense','payroll') AND ec.classification = 'DIRECT' THEN t.amount ELSE 0 END), 0) AS direct_costs,
  COALESCE(ca.allocated_indirect_costs, 0) AS allocated_indirect_costs,
  COALESCE(SUM(CASE WHEN t.transaction_type IN ('expense','payroll') AND ec.classification = 'DIRECT' THEN t.amount ELSE 0 END), 0) + COALESCE(ca.allocated_indirect_costs, 0) AS total_cost,
  COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) - (COALESCE(SUM(CASE WHEN t.transaction_type IN ('expense','payroll') AND ec.classification = 'DIRECT' THEN t.amount ELSE 0 END), 0) + COALESCE(ca.allocated_indirect_costs, 0)) AS gross_profit,
  CASE
    WHEN COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) = 0 THEN NULL
    ELSE (COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0) - (COALESCE(SUM(CASE WHEN t.transaction_type IN ('expense','payroll') AND ec.classification = 'DIRECT' THEN t.amount ELSE 0 END), 0) + COALESCE(ca.allocated_indirect_costs, 0))) /
         NULLIF(COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END), 0), 0)
  END AS profit_margin
FROM public.projects p
LEFT JOIN public.transactions t ON t.project_id = p.id
LEFT JOIN public.expense_categories ec ON ec.id = t.expense_category_id
LEFT JOIN (
  SELECT project_id, SUM(allocated_amount) AS allocated_indirect_costs
  FROM public.cost_allocations
  GROUP BY project_id
) ca ON ca.project_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.company_id, ca.allocated_indirect_costs;

DROP VIEW IF EXISTS public.vw_payroll_expense_summary;
CREATE VIEW public.vw_payroll_expense_summary AS
SELECT
  t.company_id,
  SUM(t.amount) AS payroll_total,
  COUNT(DISTINCT t.employee_id) AS employee_count
FROM public.transactions t
WHERE t.transaction_type = 'payroll'
GROUP BY t.company_id;

DROP VIEW IF EXISTS public.vw_supplier_spend;
CREATE VIEW public.vw_supplier_spend AS
SELECT
  t.company_id,
  t.supplier_id,
  SUM(t.amount) AS total_spent,
  COUNT(DISTINCT t.project_id) AS project_count
FROM public.transactions t
WHERE t.transaction_type IN ('expense','payroll') AND t.supplier_id IS NOT NULL
GROUP BY t.company_id, t.supplier_id;

DROP VIEW IF EXISTS public.vw_vehicle_costs;
CREATE VIEW public.vw_vehicle_costs AS
SELECT
  t.company_id,
  t.vehicle_id,
  SUM(t.amount) AS total_vehicle_costs,
  COUNT(DISTINCT t.project_id) AS project_count
FROM public.transactions t
WHERE t.vehicle_id IS NOT NULL
GROUP BY t.company_id, t.vehicle_id;

DROP MATERIALIZED VIEW IF EXISTS public.mv_project_profitability;
CREATE MATERIALIZED VIEW public.mv_project_profitability AS
SELECT * FROM public.vw_project_profitability;

DROP MATERIALIZED VIEW IF EXISTS public.mv_account_balances;
CREATE MATERIALIZED VIEW public.mv_account_balances AS
SELECT * FROM public.vw_account_balances;
