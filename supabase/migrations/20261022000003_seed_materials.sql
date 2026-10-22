-- ====================================================================
-- Urban Scrap Database Migration: 000003_seed_materials.sql
-- Description: Sample indicative material benchmark seed data
-- Note: Contains only material price benchmarks. No real customer names,
-- phone numbers, email addresses, or home addresses are seeded.
-- ====================================================================

insert into public.materials (id, name, category, indicative_rate, unit, description, popular, min_quantity, is_active)
values
  -- Paper
  (
    'mat-newspaper',
    'Newspaper (Raddi)',
    'paper',
    14.00,
    'kg',
    'Dry daily newspapers, magazines, and printed periodicals.',
    true,
    5,
    true
  ),
  (
    'mat-cardboard',
    'Cardboard / Corrugated Boxes',
    'paper',
    11.00,
    'kg',
    'E-commerce shipping cartons, brown carton packing boxes, flattened cartons.',
    true,
    5,
    true
  ),
  (
    'mat-office-paper',
    'Office White Paper / Notebooks',
    'paper',
    16.00,
    'kg',
    'School books, white office stationery, shreddings, and blank records.',
    false,
    5,
    true
  ),

  -- Plastic
  (
    'mat-pet-bottles',
    'PET Bottles (Water / Soft Drink)',
    'plastic',
    18.00,
    'kg',
    'Crushed clear drinking water bottles, carbonated drink containers (clean & dry).',
    true,
    3,
    true
  ),
  (
    'mat-mixed-plastic',
    'Mixed Hard Plastic',
    'plastic',
    9.00,
    'kg',
    'Buckets, plastic chairs, basins, detergent bottles, kitchen containers.',
    true,
    5,
    true
  ),
  (
    'mat-polythene-pouches',
    'Milk Pouches & Soft Poly',
    'plastic',
    12.00,
    'kg',
    'Rinsed dry milk packets, grocery LDPE film bags, stretch wraps.',
    false,
    2,
    true
  ),

  -- Metal
  (
    'mat-iron',
    'Iron Scrap (Loha)',
    'metal',
    28.00,
    'kg',
    'TMT bar cutoffs, iron pipes, window grills, bicycle frames, rusted iron.',
    true,
    10,
    true
  ),
  (
    'mat-aluminium',
    'Aluminium Scrap',
    'metal',
    110.00,
    'kg',
    'Utensils, window extrusion frames, beverage cans, aluminium ladders.',
    true,
    2,
    true
  ),
  (
    'mat-copper',
    'Copper Wire & Piping',
    'metal',
    420.00,
    'kg',
    'Stripped electrical wire coils, motor windings, AC copper tubing.',
    true,
    1,
    true
  ),
  (
    'mat-brass',
    'Brass (Peetal)',
    'metal',
    310.00,
    'kg',
    'Pooja lamps, brass plumbing fixtures, door handles, antique vessels.',
    false,
    1,
    true
  ),

  -- E-Waste
  (
    'mat-small-ewaste',
    'Small E-waste & Peripherals',
    'ewaste',
    35.00,
    'kg',
    'Keyboards, routers, chargers, mobile chargers, circuit boards, set-top boxes.',
    true,
    2,
    true
  ),
  (
    'mat-batteries',
    'Lead-Acid Batteries',
    'ewaste',
    65.00,
    'kg',
    'Two-wheeler and UPS inverter lead batteries (unbroken seal).',
    false,
    1,
    true
  ),
  (
    'mat-appliances',
    'Heavy Appliances (Microwaves / CPU)',
    'ewaste',
    250.00,
    'piece',
    'Defunct desktop cabinets, microwaves, small mini-refrigerators.',
    false,
    1,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  indicative_rate = excluded.indicative_rate,
  unit = excluded.unit,
  description = excluded.description,
  popular = excluded.popular,
  min_quantity = excluded.min_quantity,
  is_active = excluded.is_active,
  updated_at = now();
