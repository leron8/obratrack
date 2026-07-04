-- Dashboard and reporting views

create view if not exists vw_project_financial_summary as
select
  p.id as project_id,
  p.company_id,
  p.name as project_name,
  p.status as project_status,
  p.budget,
  coalesce(sum(case when t.transaction_type = 'income' then t.amount else 0 end), 0) as total_income,
  coalesce(sum(case when t.transaction_type = 'expense' then t.amount else 0 end), 0) as total_expense,
  coalesce(sum(case when t.transaction_type = 'income' then t.amount else 0 end), 0) - coalesce(sum(case when t.transaction_type = 'expense' then t.amount else 0 end), 0) as net_balance
from projects p
left join transactions t on t.project_id = p.id and t.deleted_at is null
where p.deleted_at is null
group by p.id;

create view if not exists vw_company_financial_summary as
select
  t.company_id,
  coalesce(sum(case when t.transaction_type = 'income' then t.amount else 0 end), 0) as total_income,
  coalesce(sum(case when t.transaction_type = 'expense' then t.amount else 0 end), 0) as total_expense,
  coalesce(sum(case when t.transaction_type = 'income' then t.amount else 0 end), 0) - coalesce(sum(case when t.transaction_type = 'expense' then t.amount else 0 end), 0) as net_balance,
  count(distinct p.id) as active_projects
from transactions t
left join projects p on p.id = t.project_id and p.deleted_at is null
where t.deleted_at is null
group by t.company_id;

create view if not exists vw_payroll_summary as
select
  p.company_id,
  count(distinct p.id) as active_employees,
  count(distinct pe.employee_id) as assigned_employees
from employees p
left join project_employees pe on pe.employee_id = p.id and pe.unassigned_at is null
where p.deleted_at is null
group by p.company_id;

create view if not exists vw_vehicle_costs as
select
  v.company_id,
  count(v.id) as total_vehicles,
  count(va.id) filter (where va.released_at is null) as active_assignments
from vehicles v
left join vehicle_assignments va on va.vehicle_id = v.id and va.released_at is null
where v.deleted_at is null
group by v.company_id;
